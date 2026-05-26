package kdu.og.project.scheduler;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ExecutionException;

/**
 * 서버 재시작 시 Firestore에 남아 있는 경매들을 스케줄러에 복구 등록
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuctionSchedulerRunner implements ApplicationRunner {

    private final Firestore            firestore;
    private final AuctionTaskScheduler auctionTaskScheduler;
    private final RedissonClient       redissonClient;

    private static final String AUCTIONS = "auctions";

    @Override
    public void run(ApplicationArguments args) {
        log.info("[서버 시작] Firestore의 경매들을 스케줄러에 다시 등록합니다...");

        LocalDateTime now = LocalDateTime.now();

        try {
            // ACTIVE 경매 → 종료 스케줄 복구 + Redis 현재가 복원
            List<QueryDocumentSnapshot> activeDocs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.ACTIVE.name())
                    .get().get().getDocuments();

            int activeCount = 0;
            for (QueryDocumentSnapshot doc : activeDocs) {
                Auction auction = Auction.fromFirestore(doc.getId(), doc.getData());
                if (auction.getEndTime().isAfter(now)) {
                    auctionTaskScheduler.scheduleAuctionEnd(
                            auction.getId(), auction.getEndTime());

                    RBucket<String> bucket = redissonClient.getBucket(
                            "auction_price:" + auction.getId(), StringCodec.INSTANCE);
                    bucket.set(String.valueOf(auction.getCurrentPrice()));
                    activeCount++;
                }
            }
            log.info("진행 중인 경매 {}건 복구 완료", activeCount);

            // SCHEDULED 경매 → 시작 스케줄 복구
            List<QueryDocumentSnapshot> scheduledDocs = firestore.collection(AUCTIONS)
                    .whereEqualTo("status", AuctionStatus.SCHEDULED.name())
                    .get().get().getDocuments();

            int scheduledCount = 0;
            for (QueryDocumentSnapshot doc : scheduledDocs) {
                Auction auction = Auction.fromFirestore(doc.getId(), doc.getData());
                if (auction.getStartTime() != null && auction.getStartTime().isAfter(now)) {
                    auctionTaskScheduler.scheduleAuctionStart(
                            auction.getId(), auction.getStartTime());
                    scheduledCount++;
                }
            }
            log.info("예정된 경매 {}건 예약 완료", scheduledCount);

        } catch (ExecutionException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[서버 시작] 경매 스케줄 복구 중 오류 발생", e);
        }
    }
}
