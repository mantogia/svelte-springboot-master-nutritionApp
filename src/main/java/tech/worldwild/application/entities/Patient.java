package tech.worldwild.application.entities;
import java.util.Date;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
public class Patient {
    @Id
    private long insuranceNumber;
    private String lastName;
    private String firstName;
    @Temporal(TemporalType.DATE)
    private Date birthDate;
    private long plz; 
    private String insuranceType;

    public long getInsuranceNumber() {
        return insuranceNumber;
    }
    public void setInsuranceNumber(long insuranceNumber) {
        this.insuranceNumber = insuranceNumber;
    }
    public String getLastName() {
        return lastName;
    }
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
    public String getFirstName() {
        return firstName;
    }
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    public Date getBirthDate() {
        return birthDate;
    }
    public void setBirthDate(Date birthDate) {
        this.birthDate = birthDate;
    }
    public long getPlz() {
        return plz;
    }
    public void setPlz(long plz) {
        this.plz = plz;
    }
    public String getInsuranceType() {
        return insuranceType;
    }
    public void setInsuranceType(String insuranceType) {
        this.insuranceType = insuranceType;
    }


    

}
