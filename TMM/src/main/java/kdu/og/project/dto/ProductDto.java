package kdu.og.project.dto;

import java.util.List;

public class ProductDto {

    public record Request(
            String title,
            String category,
            String type,
            Integer price,
            String region,
            String condition,
            String shipping,
            String description,
            List<String> imageUrls
    ) {}

    public record Response(
            String id,
            String title,
            String category,
            String type,
            Integer price,
            String status,
            String region,
            String condition,
            String shipping,
            String description,
            String date,
            Integer views,
            Integer wishes,
            List<String> imageUrls
    ) {}
}
