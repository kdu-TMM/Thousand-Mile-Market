package kdu.og.project.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Auction {

    private String productId;
    private Integer startPrice;
    private Integer currentPrice;
    private Integer bidCount;
    private LocalDateTime auctionEnd;
    private List<Bid> bids;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Bid {
        private String bidderId;
        private Integer price;
        private LocalDateTime bidAt;
    }
}
