package kdu.og.project.dto;

public class UserDto {

    public record RegisterRequest(
            String name,
            String phone,
            String userId,
            String password,
            String nickname,
            String email
    ) {}

    public record Response(
            String uid,
            String name,
            String nickname,
            String email,
            String region
    ) {}
}
