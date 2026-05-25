package kdu.og.project.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Redis Pub/Sub → SSE 브로드캐스트용 메시지
 */
@Data
@Builder
public class AuctionSseMessage {
    private String  auctionId;     // Firestore document ID
    private String  bidderId;      // Firebase UID
    private String  bidderName;    // 닉네임
    private Long    currentPrice;
    private String  bidTime;       // ISO-8601 문자열
    private String  newEndTime;    // 갱신된 종료 시각
    private Integer totalBids;
}
