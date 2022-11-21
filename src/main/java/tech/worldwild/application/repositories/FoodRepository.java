package tech.worldwild.application.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import tech.worldwild.application.entities.Food;

public interface FoodRepository  extends JpaRepository <Food, Long> {
    
}
