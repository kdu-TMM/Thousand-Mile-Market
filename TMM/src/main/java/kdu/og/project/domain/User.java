package kdu.og.project.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    /** Firebase UID */
    private String uid;

    private String name;
    private String nickname;
    private String phone;
    private String email;
    private String region;
    private LocalDateTime joinedAt;
}
