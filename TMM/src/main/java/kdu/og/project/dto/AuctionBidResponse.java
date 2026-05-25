package kdu.og.project.dto;

import kdu.og.project.domain.AuctionBid;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AuctionBidResponse {
    private Long          id;
    private String        bidderId;    // Firebase UID
    private String        bidderName;
    private Long          bidAmount;
    private LocalDateTime bidTime;
    private String        status;

    public static AuctionBidResponse from(AuctionBid bid) {
        return AuctionBidResponse.builder()
                .id(bid.getId())
                .bidderId(bid.getBidderId())
                .bidderName(bid.getBidderName())
                .bidAmount(bid.getBidAmount())
                .bidTime(bid.getBidTime())
                .status(bid.getStatus().name())
                .build();
    }
}
