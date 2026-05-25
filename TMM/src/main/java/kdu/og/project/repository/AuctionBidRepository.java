package kdu.og.project.repository;

import kdu.og.project.domain.Auction;
import kdu.og.project.domain.AuctionBid;
import kdu.og.project.domain.enums.AuctionStatus;
import kdu.og.project.domain.enums.BidStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuctionBidRepository extends JpaRepository<AuctionBid, Long> {

    /** 현재 최고가 입찰 조회 (ACTIVE 상태 중 최고가) */
    Optional<AuctionBid> findTopByAuctionAndStatusOrderByBidAmountDescBidTimeDesc(
            Auction auction,
            BidStatus status
    );

    /** 경매 ID로 전체 입찰 내역 조회 */
    List<AuctionBid> findByAuction_Id(Long auctionId);

    /** 진행 중 경매의 상위 5개 입찰 (가격 내림차순) */
    @EntityGraph(attributePaths = {"auction"})
    List<AuctionBid> findTop5ByAuction_StatusOrderByBidAmountDesc(AuctionStatus status);
}
