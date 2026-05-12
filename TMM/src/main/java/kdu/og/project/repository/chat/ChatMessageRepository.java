package kdu.og.project.repository.chat;

import kdu.og.project.domain.chat.ChatMessage;
import kdu.og.project.domain.chat.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByRoomOrderBySentAtAsc(ChatRoom room);

    long countByRoomAndIsReadFalseAndSenderUidNot(ChatRoom room, String senderUid);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.isRead = true " +
           "WHERE m.room = :room AND m.senderUid != :readerUid AND m.isRead = false")
    void markAllAsRead(@Param("room") ChatRoom room, @Param("readerUid") String readerUid);
}
