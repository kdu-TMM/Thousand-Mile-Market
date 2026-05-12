package kdu.og.project.repository.chat;

import kdu.og.project.domain.chat.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    Optional<ChatRoom> findByRoomKey(String roomKey);

    List<ChatRoom> findByUser1UidOrUser2UidOrderByLastMessageAtDesc(String user1Uid, String user2Uid);
}