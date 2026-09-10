-- Expand SafariPlug's bookable local services and tourist-friendly activity marketplace.
-- Categories only: no fake providers, offerings, staff, prices, or inventory are created.

insert into public.service_categories (name, slug, description, status)
values
  ('Fitness & Personal Training', 'fitness-personal-training', 'Personal trainers, gym sessions, hotel and villa workouts, strength, HIIT and functional training.', 'active'),
  ('Yoga, Pilates & Mindfulness', 'yoga-pilates-mindfulness', 'Yoga, Pilates, meditation, breathwork, sound baths and private wellness sessions.', 'active'),
  ('Boxing & Martial Arts', 'boxing-martial-arts', 'Boxing, kickboxing, martial arts, combat fitness and private self-defence training.', 'active'),
  ('Running & Cycling', 'running-cycling', 'Running coaches, guided runs, cycling sessions, bike tours and endurance training.', 'active'),
  ('Sports Recovery', 'sports-recovery', 'Sports massage, assisted stretching, mobility, physiotherapy and athletic recovery services.', 'active'),
  ('Private Chefs & Cooking', 'private-chefs-cooking', 'Private chefs, villa dining, Swahili cooking classes, food workshops and culinary experiences.', 'active'),
  ('Photography & Content', 'photography-content', 'Vacation photography, proposals, family shoots, content creation, video and social media sessions.', 'active'),
  ('Arts & Crafts', 'arts-crafts', 'Pottery, painting, beadwork, weaving, carving, jewellery, textiles and creative workshops.', 'active'),
  ('Dance & Music', 'dance-music', 'Dance lessons, Afrobeat, salsa, traditional dance, drumming, instruments and music sessions.', 'active'),
  ('Horse Riding & Equestrian', 'horse-riding-equestrian', 'Beach rides, horseback excursions, riding lessons and equestrian experiences.', 'active'),
  ('Adventure & Outdoor Skills', 'adventure-outdoor-skills', 'Climbing, hiking skills, navigation, camping, survival, bushcraft and outdoor training.', 'active')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    updated_at = now();
