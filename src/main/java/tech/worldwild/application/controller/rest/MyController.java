package tech.worldwild.application.controller.rest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import tech.worldwild.application.entities.User;
import tech.worldwild.application.repositories.UserRepository;

@RestController
class MyController {    

    @Autowired
    private UserRepository userRepository;


    @GetMapping("/patients")
    public String hallo() { 
        return "hallo velo";
    }

    @PostMapping("/users")
    User newUser(@RequestBody User newUser){
        System.out.println(newUser);
        return userRepository.save(newUser);
    }

}

