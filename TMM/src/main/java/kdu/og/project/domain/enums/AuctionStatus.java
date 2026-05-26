package kdu.og.project.domain.enums;

/**
 * 경매 상태
 */
public enum AuctionStatus {
    SCHEDULED,  // 예정
    ACTIVE,     // 진행 중
    ENDED,      // 종료 (낙찰자 결정됨)
    CANCELLED   // 취소됨
}
