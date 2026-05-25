package kdu.og.project.dto;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class OngoingAuctionResponse {
    private String              auctionId;
    private AuctionStatus       status;
    private Long                currentPrice;
    private Integer             totalBids;
    private LocalDateTime       startTime;
    private LocalDateTime       regularEndTime;
    private Boolean             overtimeStarted;
    private LocalDateTime       overtimeEndTime;
    private Integer             overtimeSeconds;
    private String              winnerName;
    private AuctionItemResponse item;

    public static OngoingAuctionResponse from(Auction auction) {
        return OngoingAuctionResponse.builder()
                .auctionId(auction.getId())
                .status(auction.getStatus())
                .currentPrice(auction.getCurrentPrice())
                .totalBids(auction.getTotalBids())
                .startTime(auction.getStartTime())
                .regularEndTime(auction.getRegularEndTime())
                .overtimeStarted(auction.getOvertimeStarted())
                .overtimeEndTime(auction.getOvertimeEndTime())
                .overtimeSeconds(auction.getOvertimeSeconds())
                .winnerName(auction.getWinnerName())
                .item(AuctionItemResponse.from(auction))
                .build();
    }
}
