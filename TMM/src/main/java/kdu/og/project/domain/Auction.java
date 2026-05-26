package kdu.og.project.domain;

import kdu.og.project.domain.enums.AuctionStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 경매 도메인 모델 (Firestore 문서 매핑)
 * JPA 엔티티 아님 — Firebase Firestore에 저장
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Auction {

    private String id; // Firestore document ID

    @Builder.Default private Long         currentPrice   = 0L;
    private String         currentBidId;  // 현재 최고 입찰의 Firestore document ID
    private LocalDateTime  startTime;
    private LocalDateTime  regularEndTime;
    @Builder.Default private Boolean      overtimeStarted = false;
    private LocalDateTime  overtimeEndTime;
    @Builder.Default private Integer      overtimeSeconds = 30;
    @Builder.Default private AuctionStatus status         = AuctionStatus.SCHEDULED;
    private String         winnerId;      // Firebase UID
    private String         winnerName;    // 닉네임 (캐시)
    @Builder.Default private Integer      totalBids       = 0;

    // 경매 물품 정보 (Firestore에 임베드)
    private String itemName;
    private String itemDescription;
    private String itemImage;

    /* ===== Firestore 변환 ===== */

    public static Auction fromFirestore(String id, Map<String, Object> data) {
        if (data == null) return null;
        String statusStr = (String) data.getOrDefault("status", "SCHEDULED");
        return Auction.builder()
                .id(id)
                .currentPrice(toLong(data.get("currentPrice"), 0L))
                .currentBidId((String) data.get("currentBidId"))
                .startTime(toLocalDateTime(data.get("startTime")))
                .regularEndTime(toLocalDateTime(data.get("regularEndTime")))
                .overtimeStarted(toBoolean(data.get("overtimeStarted"), false))
                .overtimeEndTime(toLocalDateTime(data.get("overtimeEndTime")))
                .overtimeSeconds(toInteger(data.get("overtimeSeconds"), 30))
                .status(AuctionStatus.valueOf(statusStr))
                .winnerId((String) data.get("winnerId"))
                .winnerName((String) data.get("winnerName"))
                .totalBids(toInteger(data.get("totalBids"), 0))
                .itemName((String) data.get("itemName"))
                .itemDescription((String) data.get("itemDescription"))
                .itemImage((String) data.get("itemImage"))
                .build();
    }

    public Map<String, Object> toFirestoreMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("currentPrice",    currentPrice);
        map.put("currentBidId",    currentBidId);
        map.put("startTime",       toDate(startTime));
        map.put("regularEndTime",  toDate(regularEndTime));
        map.put("overtimeStarted", overtimeStarted);
        map.put("overtimeEndTime", toDate(overtimeEndTime));
        map.put("overtimeSeconds", overtimeSeconds);
        map.put("status",          status.name());
        map.put("winnerId",        winnerId);
        map.put("winnerName",      winnerName);
        map.put("totalBids",       totalBids);
        map.put("itemName",        itemName);
        map.put("itemDescription", itemDescription);
        map.put("itemImage",       itemImage);
        return map;
    }

    /* ===== 상태 확인 ===== */

    public boolean isScheduled() { return status == AuctionStatus.SCHEDULED; }
    public boolean isActive()    { return status == AuctionStatus.ACTIVE;    }
    public boolean isEnded()     { return status == AuctionStatus.ENDED;     }

    /* ===== 도메인 로직 ===== */

    public void activate(LocalDateTime now) {
        if (!isScheduled()) throw new IllegalStateException("Scheduled 상태에서만 활성화 가능합니다");
        if (now.isBefore(startTime)) throw new IllegalStateException("시작 시간 전입니다");
        if (now.isAfter(regularEndTime)) throw new IllegalStateException("종료 시간이 지났습니다");
        this.status = AuctionStatus.ACTIVE;
    }

    public void close() {
        if (!isActive()) throw new IllegalStateException("Active 상태에서만 종료 가능합니다");
        this.overtimeStarted = false;
        this.status = AuctionStatus.ENDED;
    }

    public void validateBid(Long bidAmount) {
        if (bidAmount == null || bidAmount <= currentPrice)
            throw new IllegalStateException("현재가보다 높아야 입찰 가능합니다");
    }

    public void placeBid(String uid, String nickname, Long bidAmount, LocalDateTime bidTime) {
        if (!isActive()) throw new IllegalStateException("진행 중인 경매가 아닙니다");

        if (overtimeStarted) {
            if (bidTime.isAfter(overtimeEndTime)) throw new IllegalStateException("이연시간이 종료되었습니다");
            this.overtimeEndTime = bidTime.plusSeconds(overtimeSeconds);
        } else if (!bidTime.isBefore(regularEndTime)) {
            LocalDateTime hardLimit = regularEndTime.plusSeconds(overtimeSeconds);
            if (bidTime.isAfter(hardLimit)) throw new IllegalStateException("입찰 가능 시간이 종료되었습니다");
            startOvertime(bidTime);
        }

        validateBid(bidAmount);
        this.currentPrice = bidAmount;
        this.winnerId     = uid;
        this.winnerName   = nickname;
        this.totalBids++;
    }

    public void startOvertime(LocalDateTime now) {
        this.overtimeStarted = true;
        this.overtimeEndTime = now.plusSeconds(overtimeSeconds);
    }

    public LocalDateTime getEndTime() {
        if (Boolean.TRUE.equals(overtimeStarted) && overtimeEndTime != null) return overtimeEndTime;
        return regularEndTime.plusSeconds(overtimeSeconds);
    }

    /** [데모용] 강제 시간 변경 */
    public void changeTimeForDemo(LocalDateTime newStart, LocalDateTime newEnd) {
        this.startTime      = newStart;
        this.regularEndTime = newEnd;
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

    private static Long toLong(Object v, Long def) {
        if (v == null) return def;
        if (v instanceof Long l) return l;
        if (v instanceof Number n) return n.longValue();
        return def;
    }

    private static Integer toInteger(Object v, Integer def) {
        if (v == null) return def;
        if (v instanceof Integer i) return i;
        if (v instanceof Number n) return n.intValue();
        return def;
    }

    private static Boolean toBoolean(Object v, Boolean def) {
        if (v instanceof Boolean b) return b;
        return def;
    }
}
