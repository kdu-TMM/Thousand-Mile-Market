package kdu.og.project.domain;

import jakarta.persistence.*;
import lombok.*;

/**
 * 경매 물품 엔티티
 */
@Entity
@Table(name = "auction_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AuctionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String itemName;

    @Column(length = 1000)
    private String description;

    @Column(length = 500)
    private String itemImage;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id")
    private Auction auction;
}
