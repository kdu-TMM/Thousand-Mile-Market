package kdu.og.project.repository;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.enums.AuctionStatus;
import kdu.og.project.dto.AuctionStatusResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AuctionRepository extends JpaRepository<Auction, Long> {

    /** 예정 경매 중 시작 시간이 지난 것 조회 (활성화 대상) */
    List<Auction> findByStatusAndStartTimeBefore(AuctionStatus status, LocalDateTime now);

    /** 시간이 지난 ACTIVE 경매 조회 (이연시간 포함) */
    @Query("""
        SELECT a FROM Auction a
        WHERE a.status = kdu.og.project.domain.enums.AuctionStatus.ACTIVE
          AND (
            (a.overtimeStarted = true  AND a.overtimeEndTime  < :now)
            OR
            (a.overtimeStarted = false AND a.regularEndTime   < :regularTimeLimit)
          )
        """)
    List<Auction> findExpiredAuctions(
            @Param("now")              LocalDateTime now,
            @Param("regularTimeLimit") LocalDateTime regularTimeLimit
    );

    /** 진행 중 경매 + 물품 정보 조회 */
    @Query("""
        SELECT a FROM Auction a
        JOIN FETCH a.auctionItem
        WHERE a.status = :status
        """)
    Optional<Auction> findFirstWithItemByStatus(@Param("status") AuctionStatus status);

    /** 이연시간 대기 중인 경매 (정규 시간 종료 & 이연시간 미시작) */
    @Query("""
        SELECT a FROM Auction a
        WHERE a.status = kdu.og.project.domain.enums.AuctionStatus.ACTIVE
          AND a.overtimeStarted = false
          AND a.regularEndTime  < :now
        """)
    List<Auction> findAuctionsReadyForOvertime(@Param("now") LocalDateTime now);

    /** 예정 경매 + 물품 정보 조회 (시작 시간 오름차순) */
    @Query("""
        SELECT a FROM Auction a
        JOIN FETCH a.auctionItem
        WHERE a.status = :status
        ORDER BY a.startTime
        """)
    List<Auction> findAllByStatusOrderByStartTimeAscWithItem(@Param("status") AuctionStatus status);

    /** 진행 중 경매의 실시간 상태 (현재가, 낙찰자, 이연시간) */
    @Query("""
        SELECT new kdu.og.project.dto.AuctionStatusResponse(
            a.id,
            a.currentPrice,
            a.winnerName,
            a.overtimeStarted,
            a.overtimeEndTime,
            a.totalBids
        )
        FROM Auction a
        WHERE a.status = kdu.og.project.domain.enums.AuctionStatus.ACTIVE
        """)
    Optional<AuctionStatusResponse> findAuctionStatus();

    List<Auction> findAllByStatus(AuctionStatus status);

    /** 이번 달 낙찰된 경매 목록 */
    @Query("""
        SELECT a FROM Auction a
        JOIN FETCH a.auctionItem
        WHERE a.status         = :status
          AND a.regularEndTime BETWEEN :start AND :end
          AND a.winnerId       IS NOT NULL
        ORDER BY a.regularEndTime DESC
        """)
    List<Auction> findMonthlyWinners(
            @Param("status") AuctionStatus status,
            @Param("start")  LocalDateTime start,
            @Param("end")    LocalDateTime end
    );
}
