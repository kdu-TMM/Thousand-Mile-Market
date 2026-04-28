package kdu.og.project.dto;

import java.time.LocalDateTime;

public class AuctionDto {

    public record Request(
            String productId,
            Integer startPrice,
            Integer durationHours
    ) {}

    public record Response(
            String productId,
            Integer startPrice,
            Integer currentPrice,
            Integer bidCount,
            LocalDateTime auctionEnd
    ) {}

    public record BidRequest(
            String productId,
            Integer bidPrice
    ) {}
}
