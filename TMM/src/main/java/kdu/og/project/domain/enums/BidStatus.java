package kdu.og.project.domain.enums;

/**
 * 입찰 상태
 */
public enum BidStatus {
    ACTIVE,   // 현재 최고 입찰
    OUTBID,   // 다른 사람에게 밀림
    WINNING,  // 낙찰 (경매 종료 후)
    LOST      // 패배 (경매 종료 후)
}
