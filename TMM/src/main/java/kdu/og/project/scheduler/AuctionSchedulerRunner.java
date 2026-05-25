package kdu.og.project.scheduler;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import kdu.og.project.repository.AuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 서버 재시작 시 DB에 남아 있는 경매들을 스케줄러에 복구 등록
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuctionSchedulerRunner implements ApplicationRunner {

    private final AuctionRepository    auctionRepository;
    private final AuctionTaskScheduler auctionTaskScheduler;
    private final RedissonClient       redissonClient;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        log.info("[서버 시작] DB의 경매들을 스케줄러에 다시 등록합니다...");

        LocalDateTime now = LocalDateTime.now();

        // ACTIVE 경매 → 종료 스케줄 복구 + Redis 현재가 복원
        List<Auction> activeAuctions =
                auctionRepository.findAllByStatus(AuctionStatus.ACTIVE);
        for (Auction auction : activeAuctions) {
            if (auction.getEndTime().isAfter(now)) {
                auctionTaskScheduler.scheduleAuctionEnd(
                        auction.getId(), auction.getEndTime());

                RBucket<String> bucket = redissonClient.getBucket(
                        "auction_price:" + auction.getId(), StringCodec.INSTANCE);
                bucket.set(String.valueOf(auction.getCurrentPrice()));
            }
        }
        log.info("진행 중인 경매 {}건 복구 완료", activeAuctions.size());

        // SCHEDULED 경매 → 시작 스케줄 복구
        List<Auction> scheduledAuctions =
                auctionRepository.findAllByStatus(AuctionStatus.SCHEDULED);
        for (Auction auction : scheduledAuctions) {
            if (auction.getStartTime().isAfter(now)) {
                auctionTaskScheduler.scheduleAuctionStart(
                        auction.getId(), auction.getStartTime());
            }
        }
        log.info("예정된 경매 {}건 예약 완료", scheduledAuctions.size());
    }
}
