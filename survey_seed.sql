-- Seed data for surveys
INSERT INTO surveys (id, name, description) VALUES 
(1, 'Customer Satisfaction Survey', 'Feedback on our recent product launch and customer service experience.'),
(2, 'Employee Engagement Survey', 'Annual pulse survey regarding workplace culture and satisfaction.');

-- Seed data for questions
INSERT INTO questions (id, survey_id, type, question, body_text, img_url) VALUES 
(1, 1, 1, 'How satisfied are you with our product?', 'Please rate your overall satisfaction level.', 'https://example.com/images/q1.png'),
(2, 1, 1, 'Would you recommend us to a friend?', 'Select yes or no.', NULL),
(5, 1, 0, 'Explain things here', 'text time', NULL),
(3, 2, 1, 'How satisfied are you with your remote work tools?', NULL, NULL),
(4, 2, 0, 'How really satisfied are you tools?', NULL, NULL);

-- Seed data for question options
INSERT INTO questions_options (id, question_id, number, text_value, img_url) VALUES 
(1, 1, 101, 'Very Satisfied', NULL),
(2, 1, 102, 'Neutral', NULL),
(3, 1, 103, 'Dissatisfied', NULL),
(4, 2, 201, 'Yes', NULL),
(5, 2, 202, 'No', NULL),
(6, 3, 301, 'Extremely Satisfied', NULL),
(7, 3, 302, 'Extremely Disatisfied', NULL);

-- Seed data for submitted surveys
-- INSERT INTO submitted (id, date) VALUES 
-- (1, '2026-06-01T10:30:00Z'),
-- (2, '2026-06-01T11:15:00Z');

-- Seed data for submitted answers
-- INSERT INTO submitted_answer (id, submitted_id, question_id, json_answer) VALUES 
-- (1, 1, 1, '{"selected_option": 101, "comment": "Great experience overall!"}'),
-- (2, 2, 2, '{"selected_option": 201}');
