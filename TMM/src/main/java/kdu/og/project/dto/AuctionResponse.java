package kdu.og.project.dto;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 경매 종합 응답 DTO (월간 낙찰 내역 등)
 */
@Getter
@Builder
public class AuctionResponse {
    private String              auctionId;
    private AuctionStatus       status;
    private Long                currentPrice;
    private Integer             totalBids;
    private LocalDateTime       startTime;
    private LocalDateTime       regularEndTime;
    private Boolean             overtimeStarted;
    private LocalDateTime       overtimeEndTime;
    private Integer             overtimeSeconds;
    private AuctionItemResponse item;
    private String              winnerName;

    public static AuctionResponse from(Auction auction) {
        return AuctionResponse.builder()
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
