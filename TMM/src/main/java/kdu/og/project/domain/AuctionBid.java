package kdu.og.project.domain;

import jakarta.persistence.*;
import kdu.og.project.domain.enums.BidStatus;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 경매 입찰 엔티티
 * 입찰자 식별은 Firebase UID(String) 사용
 */
@Entity
@Table(name = "auction_bids", indexes = {
    @Index(name = "idx_bid_auction",  columnList = "auction_id"),
    @Index(name = "idx_bid_bidder",   columnList = "bidder_id"),
    @Index(name = "idx_bid_status",   columnList = "status"),
    @Index(name = "idx_bid_time",     columnList = "bid_time"),
    @Index(name = "idx_bid_ranking",  columnList = "auction_id, bid_amount DESC, bid_time DESC")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AuctionBid {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "auction_bid_id")
    private Long id;

    /** 입찰자 Firebase UID */
    @Column(name = "bidder_id", nullable = false)
    private String bidderId;

    /** 입찰자 닉네임 (Firestore에서 캐시) */
    @Column(name = "bidder_name")
    private String bidderName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id")
    private Auction auction;

    @Column(nullable = false)
    private Long bidAmount;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime bidTime = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private BidStatus status = BidStatus.ACTIVE;

    public static AuctionBid of(Auction auction, String uid, String nickname,
                                Long amount, LocalDateTime time) {
        return AuctionBid.builder()
                .auction(auction)
                .bidderId(uid)
                .bidderName(nickname)
                .bidAmount(amount)
                .bidTime(time)
                .status(BidStatus.ACTIVE)
                .build();
    }

    public boolean isActive()  { return status == BidStatus.ACTIVE;   }
    public boolean isOutBid()  { return status == BidStatus.OUTBID;   }
    public boolean isWinning() { return status == BidStatus.WINNING;  }
    public boolean isLost()    { return status == BidStatus.LOST;     }

    public void winBid() {
        if (!isActive()) throw new IllegalStateException("최고가만 낙찰 가능합니다");
        status = BidStatus.WINNING;
    }

    public void outBid() {
        if (!isActive()) throw new IllegalStateException("활성화 상태에서만 outbid가 됩니다.");
        status = BidStatus.OUTBID;
    }

    public void lostBid() {
        if (status != BidStatus.OUTBID) throw new IllegalStateException("OUTBID 상태에서만 Lost가 가능합니다");
        status = BidStatus.LOST;
    }
}
