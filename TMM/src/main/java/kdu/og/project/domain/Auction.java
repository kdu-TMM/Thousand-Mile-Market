package kdu.og.project.domain;

import jakarta.persistence.*;
import kdu.og.project.domain.enums.AuctionStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 경매 엔티티
 * 입찰자/낙찰자는 Firebase UID(String)로 참조 — User JPA 엔티티 없음
 */
@Entity
@Table(name = "auctions", indexes = {
    @Index(name = "idx_auction_status",     columnList = "status"),
    @Index(name = "idx_auction_start_time", columnList = "start_time"),
    @Index(name = "idx_auction_end_time",   columnList = "regular_end_time")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Auction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "auction_id")
    private Long id;

    /** 현재가 (항상 0P 부터 시작, 1P 단위로 입찰 가능) */
    @Column(nullable = false)
    @Builder.Default
    private Long currentPrice = 0L;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    /** 정규 종료 시간 */
    @Column(name = "regular_end_time", nullable = false)
    private LocalDateTime regularEndTime;

    /** 이연시간 시작 여부 */
    @Column(name = "over_time_started", nullable = false)
    @Builder.Default
    private Boolean overtimeStarted = false;

    /** 이연시간 종료 시각 (입찰마다 리셋) */
    @Column(name = "over_time_end_time")
    private LocalDateTime overtimeEndTime;

    /** 이연시간 (초) - 기본 30초 */
    @Column(name = "over_time_seconds", nullable = false)
    @Builder.Default
    private Integer overtimeSeconds = 30;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AuctionStatus status = AuctionStatus.SCHEDULED;

    /** 낙찰자 Firebase UID */
    @Column(name = "winner_id")
    private String winnerId;

    /** 낙찰자 닉네임 (Firestore에서 캐시) */
    @Column(name = "winner_name")
    private String winnerName;

    @Column(name = "winning_bid")
    private Long winningBid;

    @Column(name = "total_bids", nullable = false)
    @Builder.Default
    private Integer totalBids = 0;

    @OneToOne(mappedBy = "auction", fetch = FetchType.LAZY)
    private AuctionItem auctionItem;

    /* ===== 상태 확인 헬퍼 ===== */

    public boolean isScheduled() { return status == AuctionStatus.SCHEDULED; }
    public boolean isActive()    { return status == AuctionStatus.ACTIVE;    }
    public boolean isEnded()     { return status == AuctionStatus.ENDED;     }
    public boolean isCancelled() { return status == AuctionStatus.CANCELLED; }

    /* ===== 상태 전환 ===== */

    public void activate(LocalDateTime now) {
        if (!isScheduled())
            throw new IllegalStateException("Scheduled 상태에서만 활성화가 가능합니다");
        if (now.isBefore(startTime))
            throw new IllegalStateException("시작시간 전에는 활성화할 수 없습니다.");
        if (now.isAfter(regularEndTime))
            throw new IllegalStateException("정규 종료 시간이 지난 경매는 활성화할 수 없습니다.");
        this.status = AuctionStatus.ACTIVE;
    }

    public void deactivate(List<AuctionBid> bids) {
        if (!isActive())
            throw new IllegalStateException("Active 상태에서만 종료할 수 있습니다");
        for (AuctionBid bid : bids) {
            if (bid.isActive())  bid.winBid();
            else if (bid.isOutBid()) bid.lostBid();
        }
        this.overtimeStarted = false;
        this.status = AuctionStatus.ENDED;
    }

    public void cancel() { this.status = AuctionStatus.CANCELLED; }

    /* ===== 입찰 검증 ===== */

    public void validateBid(Long bidAmount) {
        if (bidAmount == null || bidAmount <= currentPrice)
            throw new IllegalStateException("현재가 보다 높아야 입찰 가능합니다");
    }

    /**
     * 입찰 처리 — User 엔티티 대신 Firebase uid / nickname 사용
     */
    public void placeBid(String uid, String nickname, Long bidAmount, LocalDateTime bidTime) {
        if (this.status != AuctionStatus.ACTIVE)
            throw new IllegalStateException("경매가 종료되었습니다.");

        if (overtimeStarted) {
            // 이미 이연시간 모드
            if (bidTime.isAfter(overtimeEndTime))
                throw new IllegalStateException("이연시간이 종료되었습니다.");
            // 입찰 성공 → 시간 30초 리셋
            this.overtimeEndTime = bidTime.plusSeconds(overtimeSeconds);
        } else {
            if (bidTime.isBefore(regularEndTime)) {
                // 정규 시간 내 입찰 — 시간 연장 없음
            } else {
                // 정규 시간 초과 → 30초 대기 기회 부여
                LocalDateTime hardLimit = regularEndTime.plusSeconds(overtimeSeconds);
                if (bidTime.isAfter(hardLimit))
                    throw new IllegalStateException("정규 시간 및 추가 대기 시간이 모두 종료되었습니다.");
                startOvertime(bidTime);
            }
        }

        validateBid(bidAmount);
        this.currentPrice = bidAmount;
        this.winnerId     = uid;
        this.winnerName   = nickname;
        this.totalBids++;
    }

    public void startOvertime(LocalDateTime now) {
        this.overtimeStarted = true;
        this.overtimeEndTime = now.plusSeconds(overtimeSeconds);
    }

    public AuctionBid createBid(String uid, String nickname, Long bidAmount, LocalDateTime bidTime) {
        return AuctionBid.of(this, uid, nickname, bidAmount, bidTime);
    }

    /** 실효 종료 시각 (이연시간 포함) */
    public LocalDateTime getEndTime() {
        if (Boolean.TRUE.equals(overtimeStarted) && overtimeEndTime != null)
            return overtimeEndTime;
        return regularEndTime.plusSeconds(overtimeSeconds);
    }

    /** [데모용] 강제 시간 변경 */
    public void changeTimeForDemo(LocalDateTime newStartTime, LocalDateTime newEndTime) {
        this.startTime      = newStartTime;
        this.regularEndTime = newEndTime;
    }
}
