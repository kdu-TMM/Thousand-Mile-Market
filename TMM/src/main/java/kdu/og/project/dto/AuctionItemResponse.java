package kdu.og.project.dto;

import kdu.og.project.domain.Auction;

public record AuctionItemResponse(
        String itemName,
        String description,
        String imageUrl
) {
    public static AuctionItemResponse from(Auction auction) {
        if (auction == null) return null;
        return new AuctionItemResponse(
                auction.getItemName(),
                auction.getItemDescription(),
                auction.getItemImage()
        );
    }
}
