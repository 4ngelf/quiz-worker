-- Seed data for surveys
INSERT INTO surveys (id, name, description) VALUES 
(1, 'Customer Satisfaction Survey', 'Feedback on our recent product launch and customer service experience.'),
(2, 'Employee Engagement Survey', 'Annual pulse survey regarding workplace culture and satisfaction.');

-- Seed data for questions
INSERT INTO questions (id, survey_id, type, question, body_text, img_url, max_options) VALUES 
(1, 1, 1, 'How satisfied are you with our product?', 'Please rate your overall satisfaction level.', 'https://static.vecteezy.com/system/resources/previews/003/570/922/original/customer-satisfaction-meter-with-different-emotions-emotions-scale-background-vector.jpg', 1),
(2, 1, 1, 'Would you recommend us to a friend?', 'Select yes or no.', NULL, 1),
(5, 1, 0, 'Explain things here', 'text time', NULL, 1),
(3, 2, 1, 'How satisfied are you with your remote work tools?', NULL, NULL, 2),
(4, 2, 0, 'How really satisfied are you tools?', NULL, NULL, 1);

-- Seed data for question options
INSERT INTO questions_options (id, question_id, number, text_value, is_alternative, img_url) VALUES 
(1, 1, 101, 'Very Satisfied', FALSE, NULL),
(2, 1, 102, 'Neutral', FALSE, NULL),
(3, 1, 103, 'Dissatisfied', FALSE, NULL),
(4, 2, 201, 'Yes', FALSE, NULL),
(5, 2, 202, 'No', FALSE, NULL),
(6, 3, 301, 'Extremely Satisfied', FALSE, NULL),
(7, 3, 302, 'Extremely Disatisfied', FALSE, NULL),
(8, 3, 303, 'Another state of mind', TRUE, NULL);

-- Seed data for submitted surveys
-- INSERT INTO submitted (id, date) VALUES 
-- (1, '2026-06-01T10:30:00Z'),
-- (2, '2026-06-01T11:15:00Z');

-- Seed data for submitted answers
-- INSERT INTO submitted_answer (id, submitted_id, question_id, json_answer) VALUES 
-- (1, 1, 1, '{"selected_option": 101, "comment": "Great experience overall!"}'),
-- (2, 2, 2, '{"selected_option": 201}');
