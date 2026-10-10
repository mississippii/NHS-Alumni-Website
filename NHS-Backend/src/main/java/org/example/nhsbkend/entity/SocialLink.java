package org.example.nhsbkend.entity;

import org.example.nhsbkend.service.Socials;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One social profile of a student: at most one per platform. The URL is checked before display (see Socials). */
@Entity
@Table(name = "social_link", uniqueConstraints = @UniqueConstraint(name = "uk_social_platform", columnNames = {"alumnus_id", "platform"}))
@Getter
@Setter
@NoArgsConstructor
public class SocialLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "alumnus_id", foreignKey = @ForeignKey(name = "fk_social_alumnus"))
    private Alumnus alumnus;

    @Column(nullable = false, length = 20)
    private String platform; // facebook | linkedin | youtube | twitter

    @Column(nullable = false, length = 200)
    private String url; // as entered: full link or just a username

    public SocialLink(Alumnus alumnus, String platform, String url) {
        this.alumnus = alumnus;
        this.platform = platform;
        this.url = url;
    }
}
