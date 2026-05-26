package kdu.og.project.service;

import com.google.cloud.firestore.*;
import kdu.og.project.domain.Auction;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import kdu.og.project.domain.AuctionBid;
import kdu.og.project.domain.enums.AuctionStatus;
import kdu.og.project.domain.enums.BidStatus;
import kdu.og.project.dto.*;
import kdu.og.project.scheduler.AuctionTaskScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuctionService {

    private final Firestore            firestore;
    private final AuctionTaskScheduler auctionTaskScheduler;
    private final AuctionSseService    auctionSseService;
    private final RedissonClient       redissonClient;

    private static final String AUCTIONS     = "auctions";
    private static final String AUCTION_BIDS = "auctionBids";

    // ===== 입찰 =====

    /**
     * 입찰 처리 (Firestore 트랜잭션)
     * @param uid      입찰자 Firebase UID
     * @param nickname 입찰자 닉네임
     */
    public void placeBid(String auctionId, String uid, String nickname,
                         Long bidAmount, LocalDateTime bidTime) {

        DocumentReference auctionRef = firestore.collection(AUCTIONS).document(auctionId);
        final Auction[] holder = new Auction[1];

        try {
            firestore.runTransaction(transaction -> {
                DocumentSnapshot snap = transaction.get(auctionRef).get();
                if (!snap.exists())
                    throw new IllegalArgumentException("경매를 찾을 수 없습니다. id=" + auctionId);

                Auction auction = Auction.fromFirestore(auctionId, snap.getData());

                // 이전 최고 입찰자 OUTBID 처리
                String prevBidId = auction.getCurrentBidId();
                if (prevBidId != null && !prevBidId.isBlank()) {
                    DocumentReference prevBidRef =
                            firestore.collection(AUCTION_BIDS).document(prevBidId);
                    transaction.update(prevBidRef, "status", BidStatus.OUTBID.name());
                }

                // 도메인 입찰 처리 (현재가·낙찰자·이연시간 갱신)
                auction.placeBid(uid, nickname, bidAmount, bidTime);

                // 새 입찰 문서 등록
                DocumentReference newBidRef = firestore.collection(AUCTION_BIDS).document();
                AuctionBid newBid = AuctionBid.builder()
                        .id(newBidRef.getId())
                        .auctionId(auctionId)
                        .bidderId(uid)
                        .bidderName(nickname)
                        .bidAmount(bidAmount)
                        .bidTime(bidTime)
                        .status(BidStatus.ACTIVE)
                        .build();
                transaction.set(newBidRef, newBid.toFirestoreMap());

                // 경매 업데이트 (currentBidId 포함)
                auction.setCurrentBidId(newBidRef.getId());
                transaction.set(auctionRef, auction.toFirestoreMap());

                holder[0] = auction;
                return null;
            }).get();

        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof IllegalStateException ise)    throw ise;
            if (cause instanceof IllegalArgumentException iae) throw iae;
            throw new RuntimeException("Firestore 입찰 처리 실패", cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Firestore 입찰 처리 중단", e);
        }

        Auction auction = holder[0];

        // 스케줄러 종료 시각 갱신 (이연시간 반영)
        auctionTaskScheduler.scheduleAuctionEnd(auctionId, auction.getEndTime());

        // Redis 현재가 갱신
        RBucket<String> bucket = redissonClient.getBucket(
                "auction_price:" + auctionId, StringCodec.INSTANCE);
        bucket.set(String.valueOf(auction.getCurrentPrice()));

        // SSE 브로드캐스트
        AuctionSseMessage message = AuctionSseMessage.builder()
                .auctionId(auctionId)
                .bidderId(uid)
                .bidderName(nickname)
                .currentPrice(auction.getCurrentPrice())
                .bidTime(bidTime.atZone(ZoneId.of("Asia/Seoul"))
                        .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .newEndTime(auction.getEndTime().atZone(ZoneId.of("Asia/Seoul"))
                        .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .totalBids(auction.getTotalBids())
                .build();
        auctionSseService.broadcast(message);
    }

    // ===== 상태 전환 =====

    /** SCHEDULED → ACTIVE (스케줄러 호출) */
    public void activateScheduledAuctions(LocalDateTime now) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.SCHEDULED.name())
                    .get().get().getDocuments();

            for (QueryDocumentSnapshot doc : docs) {
                Auction auction = Auction.fromFirestore(doc.getId(), doc.getData());
                try {
                    auction.activate(now);
                    firestore.collection(AUCTIONS)
                            .document(auction.getId())
                            .set(auction.toFirestoreMap()).get();

                    RBucket<String> bucket = redissonClient.getBucket(
                            "auction_price:" + auction.getId(), StringCodec.INSTANCE);
                    bucket.set(String.valueOf(auction.getCurrentPrice()));
                    log.info("경매 활성화 완료: ID={}", auction.getId());
                } catch (IllegalStateException e) {
                    log.warn("경매 활성화 건너뜀 (ID={}): {}", auction.getId(), e.getMessage());
                }
            }
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("경매 활성화 처리 중 오류", e);
        }
    }

    /** ACTIVE → ENDED (스케줄러 호출) */
    public void closeExpiredAuctions(LocalDateTime now) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.ACTIVE.name())
                    .get().get().getDocuments();

            for (QueryDocumentSnapshot doc : docs) {
                Auction auction = Auction.fromFirestore(doc.getId(), doc.getData());
                if (isExpired(auction, now)) {
                    try {
                        processSingleAuctionClose(auction);
                    } catch (Exception e) {
                        log.error("경매 ID {} 종료 처리 중 오류", auction.getId(), e);
                    }
                }
            }
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("경매 종료 처리 중 오류", e);
        }
    }

    private boolean isExpired(Auction auction, LocalDateTime now) {
        if (Boolean.TRUE.equals(auction.getOvertimeStarted())) {
            return auction.getOvertimeEndTime() != null
                    && now.isAfter(auction.getOvertimeEndTime());
        }
        int overtimeSecs = auction.getOvertimeSeconds() != null ? auction.getOvertimeSeconds() : 30;
        LocalDateTime hardLimit = auction.getRegularEndTime().plusSeconds(overtimeSecs);
        return now.isAfter(hardLimit);
    }

    public void processSingleAuctionClose(Auction auction) {
        try {
            auction.close();
            firestore.collection(AUCTIONS)
                    .document(auction.getId())
                    .set(auction.toFirestoreMap()).get();

            AuctionSseMessage message = AuctionSseMessage.builder()
                    .auctionId(auction.getId())
                    .currentPrice(auction.getCurrentPrice())
                    .bidderId(auction.getWinnerId())
                    .bidderName(auction.getWinnerName())
                    .totalBids(auction.getTotalBids())
                    .build();
            auctionSseService.broadcast(message);
            log.info("경매 종료 완료: ID={}", auction.getId());
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("경매 종료 Firestore 업데이트 실패", e);
        }
    }

    // ===== 조회 =====

    /** 진행 중 경매 + 물품 정보 */
    public OngoingAuctionResponse getOngoingAuctionWithItem() {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.ACTIVE.name())
                    .limit(1)
                    .get().get().getDocuments();

            if (docs.isEmpty()) return null;

            Auction auction = Auction.fromFirestore(docs.get(0).getId(), docs.get(0).getData());

            if (auction.getEndTime().isBefore(LocalDateTime.now())) {
                log.info("조회 시점 경매 만료 감지! 강제 종료 처리 (ID: {})", auction.getId());
                closeExpiredAuctions(LocalDateTime.now());
                return null;
            }

            return OngoingAuctionResponse.from(auction);
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("진행 중 경매 조회 실패", e);
            return null;
        }
    }

    /** 예정 경매 목록 + 물품 정보 */
    public List<ScheduledAuctionResponse> scheduledAuctionWithItem() {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.SCHEDULED.name())
                    .orderBy("startTime")
                    .get().get().getDocuments();

            return docs.stream()
                    .map(doc -> Auction.fromFirestore(doc.getId(), doc.getData()))
                    .map(ScheduledAuctionResponse::from)
                    .collect(Collectors.toList());
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("예정 경매 조회 실패", e);
            return List.of();
        }
    }

    /** 진행 중 경매 상위 5개 입찰 내역 */
    public List<AuctionBidResponse> getAuctionStatus() {
        try {
            List<QueryDocumentSnapshot> auctionDocs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.ACTIVE.name())
                    .limit(1)
                    .get().get().getDocuments();

            if (auctionDocs.isEmpty()) return List.of();

            String auctionId = auctionDocs.get(0).getId();

            List<QueryDocumentSnapshot> bidDocs = firestore.collection(AUCTION_BIDS)
                    .whereEqualTo("auctionId", auctionId)
                    .orderBy("bidAmount", Query.Direction.DESCENDING)
                    .limit(5)
                    .get().get().getDocuments();

            return bidDocs.stream()
                    .map(doc -> AuctionBid.fromFirestore(doc.getId(), doc.getData()))
                    .map(AuctionBidResponse::from)
                    .collect(Collectors.toList());
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("입찰 내역 조회 실패", e);
            return List.of();
        }
    }

    /** 이번 달 낙찰 목록 */
    public List<AuctionResponse> getMonthlyWinners() {
        LocalDateTime now          = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1)
                .withHour(0).withMinute(0).withSecond(0).withNano(0);
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.ENDED.name())
                    .get().get().getDocuments();

            return docs.stream()
                    .map(doc -> Auction.fromFirestore(doc.getId(), doc.getData()))
                    .filter(a -> a.getWinnerId() != null)
                    .filter(a -> a.getRegularEndTime() != null
                            && !a.getRegularEndTime().isBefore(startOfMonth)
                            && !a.getRegularEndTime().isAfter(now))
                    .sorted(Comparator.comparing(Auction::getRegularEndTime).reversed())
                    .map(AuctionResponse::from)
                    .collect(Collectors.toList());
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("월간 낙찰 내역 조회 실패", e);
            return List.of();
        }
    }

    // ===== 데모용 =====

    /** [데모] 정규 시간 즉시 종료 → 이연시간 진입 가능 상태로 */
    public void expireRegularTime(String auctionId) {
        try {
            DocumentSnapshot snap = firestore.collection(AUCTIONS).document(auctionId).get().get();
            if (!snap.exists()) throw new IllegalArgumentException("경매를 찾을 수 없습니다.");

            Auction auction = Auction.fromFirestore(auctionId, snap.getData());
            auction.changeTimeForDemo(auction.getStartTime(), LocalDateTime.now().minusSeconds(1));
            firestore.collection(AUCTIONS).document(auctionId).set(auction.toFirestoreMap()).get();
            log.info("[데모] 경매 ID {} 정규 시간 종료 처리 완료", auctionId);
        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("데모 시간 변경 실패", e);
        }
    }
}
