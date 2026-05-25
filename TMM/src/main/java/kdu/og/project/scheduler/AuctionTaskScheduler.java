package kdu.og.project.scheduler;

import kdu.og.project.service.AuctionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * 경매 시작/종료를 동적으로 스케줄링하는 컴포넌트
 */
@Slf4j
@Component
public class AuctionTaskScheduler {

    private final TaskScheduler  taskScheduler;
    private final AuctionService auctionService;

    /** 종료 예약들을 보관 — 입찰 시 취소 후 재등록 (이연시간 연장 로직) */
    private final Map<String, ScheduledFuture<?>> scheduledEndTasks = new ConcurrentHashMap<>();

    public AuctionTaskScheduler(
            @Qualifier("auctionScheduler") TaskScheduler taskScheduler,
            @Lazy AuctionService auctionService) {
        this.taskScheduler  = taskScheduler;
        this.auctionService = auctionService;
    }

    /** 경매 시작 시각 예약 */
    public void scheduleAuctionStart(String auctionId, LocalDateTime startTime) {
        Runnable task = () -> {
            log.info("경매 시작 자동 실행! (Auction ID: {})", auctionId);
            auctionService.activateScheduledAuctions(LocalDateTime.now());
        };
        taskScheduler.schedule(task,
                startTime.atZone(ZoneId.systemDefault()).toInstant());
        log.info("경매 시작 예약 완료: ID={}, 시각={}", auctionId, startTime);
    }

    /**
     * 경매 종료 시각 예약
     * 입찰 발생 시 기존 예약을 취소하고 새 시각으로 재등록 (이연시간 연장)
     */
    public void scheduleAuctionEnd(String auctionId, LocalDateTime endTime) {
        // 기존 예약 취소
        ScheduledFuture<?> existing = scheduledEndTasks.get(auctionId);
        if (existing != null) {
            existing.cancel(false);
            log.info("기존 종료 예약 취소됨 (이연시간 연장): ID={}", auctionId);
        }

        Runnable task = () -> {
            log.info("경매 종료 자동 실행! (Auction ID: {})", auctionId);
            auctionService.closeExpiredAuctions(LocalDateTime.now());
            scheduledEndTasks.remove(auctionId);
        };

        ScheduledFuture<?> scheduled = taskScheduler.schedule(task,
                endTime.atZone(ZoneId.systemDefault()).toInstant());
        scheduledEndTasks.put(auctionId, scheduled);
        log.info("경매 종료 예약 완료: ID={}, 시각={}", auctionId, endTime);
    }
}
