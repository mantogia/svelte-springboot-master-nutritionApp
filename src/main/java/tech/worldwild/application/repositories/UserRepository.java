package tech.worldwild.application.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import tech.worldwild.application.entities.User;

public interface UserRepository extends JpaRepository<User, Long>{
    
}
