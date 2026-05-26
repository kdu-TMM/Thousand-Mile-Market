package kdu.og.project.dto;

import java.time.LocalDateTime;

public record AuctionStatusResponse(
        String        auctionId,
        Long          currentPrice,
        String        winnerName,
        Boolean       overtimeStarted,
        LocalDateTime overtimeEndTime,
        Integer       totalBids
) {}
