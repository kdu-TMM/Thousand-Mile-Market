package kdu.og.project.domain;

import kdu.og.project.domain.enums.BidStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 입찰 도메인 모델 (Firestore 문서 매핑)
 * JPA 엔티티 아님 — Firebase Firestore에 저장
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionBid {

    private String        id;           // Firestore document ID
    private String        auctionId;    // 경매 document ID
    private String        bidderId;     // Firebase UID
    private String        bidderName;   // 닉네임 (캐시)
    private Long          bidAmount;
    private LocalDateTime bidTime;
    @Builder.Default
    private BidStatus     status = BidStatus.ACTIVE;

    /* ===== Firestore 변환 ===== */

    public static AuctionBid fromFirestore(String id, Map<String, Object> data) {
        if (data == null) return null;
        return AuctionBid.builder()
                .id(id)
                .auctionId((String) data.get("auctionId"))
                .bidderId((String) data.get("bidderId"))
                .bidderName((String) data.get("bidderName"))
                .bidAmount(toLong(data.get("bidAmount")))
                .bidTime(toLocalDateTime(data.get("bidTime")))
                .status(BidStatus.valueOf((String) data.getOrDefault("status", "ACTIVE")))
                .build();
    }

    public Map<String, Object> toFirestoreMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("auctionId",  auctionId);
        map.put("bidderId",   bidderId);
        map.put("bidderName", bidderName);
        map.put("bidAmount",  bidAmount);
        map.put("bidTime",    toDate(bidTime));
        map.put("status",     status.name());
        return map;
    }

    /* ===== 변환 헬퍼 ===== */

    private static LocalDateTime toLocalDateTime(Object v) {
        if (v == null) return null;
        if (v instanceof Date d) return d.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
        if (v instanceof com.google.cloud.Timestamp ts)
            return ts.toDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
        return null;
    }

    private static Date toDate(LocalDateTime ldt) {
        return ldt == null ? null : Date.from(ldt.atZone(ZoneId.systemDefault()).toInstant());
    }

    private static Long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Long l) return l;
        if (v instanceof Number n) return n.longValue();
        return 0L;
    }
}
