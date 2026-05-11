package kdu.og.project.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class PageController {

    @GetMapping("/")
    public String index() { return "index"; }

    @GetMapping("/sell")
    public String sell() { return "sell"; }

    @GetMapping("/my-sales")
    public String mySales() { return "my-sales"; }

    @GetMapping("/my-list")
    public String myList() { return "my-list"; }

    @GetMapping("/chat")
    public String chat() { return "chat"; }

    @GetMapping("/support")
    public String support() { return "support"; }

    @GetMapping("/mypage")
    public String mypage() { return "mypage"; }

    @GetMapping("/verify")
    public String verify() { return "verify"; }

    @GetMapping("/signup")
    public String signup() { return "signup"; }

    @GetMapping("/product/{id}")
    public String product(@PathVariable String id) { return "product"; }

    @GetMapping("/migrate")
    public String migrate() { return "migrate"; }
}
