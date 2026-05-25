package kdu.og.project.dto;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ScheduledAuctionResponse {
    private Long              auctionId;
    private AuctionStatus     status;
    private LocalDateTime     startTime;
    private LocalDateTime     regularEndTime;
    private Integer           overtimeSeconds;
    private AuctionItemResponse item;

    public static ScheduledAuctionResponse from(Auction auction) {
        return ScheduledAuctionResponse.builder()
                .auctionId(auction.getId())
                .status(auction.getStatus())
                .startTime(auction.getStartTime())
                .regularEndTime(auction.getRegularEndTime())
                .overtimeSeconds(auction.getOvertimeSeconds())
                .item(AuctionItemResponse.from(auction.getAuctionItem()))
                .build();
    }
}
