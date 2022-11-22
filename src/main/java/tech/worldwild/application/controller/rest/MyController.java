package tech.worldwild.application.controller.rest;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import tech.worldwild.application.entities.Food_Ratings;
import tech.worldwild.application.entities.User;
import tech.worldwild.application.repositories.Food_RatingsRepository;
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
        return userRepository.save(newUser);
    }

    @PostMapping("/food_ratings")
    User newFoodRating(@RequestBody Food_Ratings newFoodRating){
        newFoodRating.getUser().getRatings().add(newFoodRating);
        return userRepository.save(newFoodRating.getUser());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUserByID(@PathVariable("id") Long id) {
        Optional<User> u = userRepository.findById(id);

        if(!u.isEmpty()){
            return new ResponseEntity<User>(u.get(), HttpStatus.OK);
        }else{
            return new ResponseEntity<User>(HttpStatus.NOT_FOUND);
        }
        

        
    }

}

