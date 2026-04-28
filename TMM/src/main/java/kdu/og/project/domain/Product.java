package kdu.og.project.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    private String id;
    private String title;
    private String category;

    /** "normal" | "auction" */
    private String type;

    /** 일반 판매 가격 */
    private Integer price;

    /** 판매중 | 예약중 | 판매완료 | 경매중 */
    private String status;

    private String region;
    private String condition;
    private String shipping;
    private String description;
    private String date;

    private Integer views;
    private Integer wishes;

    private String sellerId;
    private List<String> imageUrls;
}
