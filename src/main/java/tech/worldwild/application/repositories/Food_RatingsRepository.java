package tech.worldwild.application.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import tech.worldwild.application.entities.Food_Ratings;

public interface Food_RatingsRepository extends JpaRepository<Food_Ratings, Long> {
    
}
