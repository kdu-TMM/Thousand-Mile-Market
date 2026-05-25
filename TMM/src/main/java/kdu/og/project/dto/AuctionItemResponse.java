package kdu.og.project.dto;

import kdu.og.project.domain.AuctionItem;

public record AuctionItemResponse(
        Long   itemId,
        String itemName,
        String description,
        String imageUrl
) {
    public static AuctionItemResponse from(AuctionItem item) {
        if (item == null) return null;
        return new AuctionItemResponse(
                item.getId(),
                item.getItemName(),
                item.getDescription(),
                item.getItemImage()
        );
    }
}
