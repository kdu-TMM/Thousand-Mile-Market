package kdu.og.project.service;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.AuctionBid;
import kdu.og.project.domain.enums.AuctionStatus;
import kdu.og.project.domain.enums.BidStatus;
import kdu.og.project.dto.*;
import kdu.og.project.repository.AuctionBidRepository;
import kdu.og.project.repository.AuctionRepository;
import kdu.og.project.scheduler.AuctionTaskScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuctionService {

    private final AuctionRepository    auctionRepository;
    private final AuctionBidRepository auctionBidRepository;
    private final AuctionTaskScheduler auctionTaskScheduler;
    private final AuctionSseService    auctionSseService;
    private final RedissonClient       redissonClient;

    /** 자기 자신 프록시 — REQUIRES_NEW 트랜잭션 분리를 위해 @Lazy 사용 */
    @Lazy
    @Autowired
    private AuctionService self;

    // ===== 입찰 =====

    /**
     * 입찰 처리
     * @param uid      입찰자 Firebase UID
     * @param nickname 입찰자 닉네임
     */
    public void placeBid(Long auctionId, String uid, String nickname,
                         Long bidAmount, LocalDateTime bidTime) {

        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new IllegalArgumentException("경매를 찾을 수 없습니다. id=" + auctionId));

        // 이전 최고 입찰자 상태 변경 (ACTIVE → OUTBID)
        auctionBidRepository
                .findTopByAuctionAndStatusOrderByBidAmountDescBidTimeDesc(auction, BidStatus.ACTIVE)
                .ifPresent(AuctionBid::outBid);

        // 도메인 입찰 처리 (현재가·낙찰자·이연시간 갱신)
        auction.placeBid(uid, nickname, bidAmount, bidTime);

        // 입찰 엔티티 저장
        AuctionBid bid = auction.createBid(uid, nickname, bidAmount, bidTime);
        auctionBidRepository.save(bid);

        // 스케줄러 종료 시각 갱신 (이연시간 반영)
        auctionTaskScheduler.scheduleAuctionEnd(auction.getId(), auction.getEndTime());

        // Redis 현재가 갱신
        RBucket<String> bucket = redissonClient.getBucket(
                "auction_price:" + auction.getId(), StringCodec.INSTANCE);
        bucket.set(String.valueOf(auction.getCurrentPrice()));

        // 트랜잭션 커밋 후 SSE 브로드캐스트
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

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            auctionSseService.broadcast(message);
                        }
                    });
        } else {
            auctionSseService.broadcast(message);
        }
    }

    // ===== 상태 전환 =====

    /** SCHEDULED → ACTIVE (스케줄러 호출) */
    public void activateScheduledAuctions(LocalDateTime now) {
        List<Auction> auctions =
                auctionRepository.findByStatusAndStartTimeBefore(AuctionStatus.SCHEDULED, now);
        for (Auction auction : auctions) {
            auction.activate(now);

            RBucket<String> bucket = redissonClient.getBucket(
                    "auction_price:" + auction.getId(), StringCodec.INSTANCE);
            bucket.set(String.valueOf(auction.getCurrentPrice()));
        }
    }

    /** ACTIVE → ENDED (스케줄러 호출) */
    public void closeExpiredAuctions(LocalDateTime now) {
        LocalDateTime endedTimeThreshold = now.minusSeconds(30);
        List<Auction> auctions =
                auctionRepository.findExpiredAuctions(now, endedTimeThreshold);

        for (Auction auction : auctions) {
            try {
                // REQUIRES_NEW: 개별 경매 실패가 전체에 영향 주지 않도록 분리
                self.processSingleAuctionClose(auction);
            } catch (Exception e) {
                log.error("경매 ID {} 종료 처리 중 오류 발생", auction.getId(), e);
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processSingleAuctionClose(Auction auction) {
        // 새 트랜잭션에서 엔티티 재조회
        Auction current = auctionRepository.findById(auction.getId())
                .orElseThrow(() -> new IllegalArgumentException("경매를 찾을 수 없습니다."));

        List<AuctionBid> bids = auctionBidRepository.findByAuction_Id(current.getId());
        current.deactivate(bids);
        auctionRepository.saveAndFlush(current);

        // SSE 종료 알림
        AuctionSseMessage message = AuctionSseMessage.builder()
                .auctionId(current.getId())
                .currentPrice(current.getCurrentPrice())
                .bidderId(current.getWinnerId())
                .bidderName(current.getWinnerName())
                .totalBids(current.getTotalBids())
                .build();
        auctionSseService.broadcast(message);
    }

    // ===== 조회 =====

    /** 진행 중 경매 + 물품 정보 */
    public OngoingAuctionResponse getOngoingAuctionWithItem() {
        Auction auction = auctionRepository
                .findFirstWithItemByStatus(AuctionStatus.ACTIVE)
                .orElse(null);

        if (auction == null) return null;

        // 시간이 이미 지났으면 강제 종료 후 null 반환
        if (auction.getEndTime().isBefore(LocalDateTime.now())) {
            log.info("조회 시점 경매 만료 감지! 강제 종료 처리 (ID: {})", auction.getId());
            closeExpiredAuctions(LocalDateTime.now());
            return null;
        }

        return OngoingAuctionResponse.from(auction);
    }

    /** 예정 경매 목록 + 물품 정보 */
    public List<ScheduledAuctionResponse> scheduledAuctionWithItem() {
        return auctionRepository
                .findAllByStatusOrderByStartTimeAscWithItem(AuctionStatus.SCHEDULED)
                .stream()
                .map(ScheduledAuctionResponse::from)
                .toList();
    }

    /** 진행 중 경매 상위 5개 입찰 내역 */
    public List<AuctionBidResponse> getAuctionStatus() {
        return auctionBidRepository
                .findTop5ByAuction_StatusOrderByBidAmountDesc(AuctionStatus.ACTIVE)
                .stream()
                .map(AuctionBidResponse::from)
                .toList();
    }

    /** 이번 달 낙찰 목록 */
    public List<AuctionResponse> getMonthlyWinners() {
        LocalDateTime now          = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);

        return auctionRepository
                .findMonthlyWinners(AuctionStatus.ENDED, startOfMonth, now)
                .stream()
                .filter(a -> a.getWinnerId() != null)
                .map(AuctionResponse::from)
                .collect(Collectors.toList());
    }

    // ===== 데모용 =====

    /** [데모] 정규 시간 즉시 종료 → 이연시간 진입 가능 상태로 만들기 */
    public void expireRegularTime(Long auctionId) {
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new IllegalArgumentException("경매를 찾을 수 없습니다."));
        auction.changeTimeForDemo(auction.getStartTime(), LocalDateTime.now().minusSeconds(1));
        auctionRepository.saveAndFlush(auction);
        log.info("[데모] 경매 ID {} 정규 시간 종료 처리 완료", auctionId);
    }
}
