-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 22, 2025 at 06:40 AM
-- Server version: 10.11.13-MariaDB
-- PHP Version: 8.3.23

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `trimworldwide_bb`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT 'Administrator',
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `latestOtp` int(11) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `status` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`id`, `name`, `email`, `password`, `latestOtp`, `deleted`, `status`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
(1, 'Administrator', 'admin@gmail.com', '123456', 5418, 0, 1, '2025-03-28 11:43:49', '2025-07-02 08:08:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `addresses`
--

CREATE TABLE `addresses` (
  `id` int(11) NOT NULL,
  `companyaddress` varchar(255) DEFAULT '',
  `addressLineOne` varchar(255) DEFAULT NULL,
  `addressLineTwo` varchar(255) DEFAULT NULL,
  `town` varchar(255) DEFAULT NULL,
  `zipCode` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `lat` varchar(255) DEFAULT NULL,
  `lng` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `cityInSystemId` int(11) DEFAULT NULL,
  `countryInSystemId` int(11) DEFAULT NULL,
  `stateInSystemId` int(11) DEFAULT NULL,
  `territoryId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `addresses`
--

INSERT INTO `addresses` (`id`, `companyaddress`, `addressLineOne`, `addressLineTwo`, `town`, `zipCode`, `country`, `state`, `lat`, `lng`, `status`, `deleted`, `createdAt`, `updatedAt`, `deletedAt`, `cityInSystemId`, `countryInSystemId`, `stateInSystemId`, `territoryId`, `userId`) VALUES
(136, NULL, '8010 Sunport Drive Ste 122', '', 'ORLANDO', '32809', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-20 00:00:00', '2025-03-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 1),
(137, NULL, '479 West Eads Parkway', '', 'Lawrenceberg', '47025', 'United States', 'Indiana', NULL, NULL, 1, 0, '2023-10-30 00:00:00', '2023-10-30 00:00:00', NULL, NULL, NULL, NULL, NULL, 2),
(138, NULL, '21120 US Hwy 84', '', 'Abiquiu', '87510', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2023-02-22 00:00:00', '2023-02-22 00:00:00', NULL, NULL, NULL, NULL, NULL, 3),
(139, NULL, '2852 wild orchid ct', '', 'Naples', '34119', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-04-09 00:00:00', '2023-04-09 00:00:00', NULL, NULL, NULL, NULL, NULL, 4),
(140, NULL, '1100 WEST GRAND RIVER AVE', '', 'WILLIAMSTON', '48895', 'United States', 'Michigan', NULL, NULL, 1, 0, '2023-01-04 00:00:00', '2023-01-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 5),
(141, NULL, '202 Lincoln St', '', 'Dothan', '36303', 'United States', 'Alabama', NULL, NULL, 1, 0, '2025-02-27 00:00:00', '2025-02-27 00:00:00', NULL, NULL, NULL, NULL, NULL, 6),
(142, NULL, '4812 Deer Lake Dr W', '', 'Jacksonville', '32246', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-05-29 00:00:00', '2024-05-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 7),
(143, NULL, '5730 central Florida pkwy', '', 'orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-11-03 00:00:00', '2023-11-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 8),
(144, NULL, '15220 NE Shen St Suite 150', '', 'Redmond, WA', '98052', 'United States', 'Washington', NULL, NULL, 1, 0, '2024-10-30 00:00:00', '2024-10-30 00:00:00', NULL, NULL, NULL, NULL, NULL, 9),
(145, NULL, '751 Skymarks Dr', '', 'Jacksonville', '32218', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-17 00:00:00', '2024-01-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 10),
(146, NULL, '7215 Corner Drive', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-10 00:00:00', '2025-06-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 11),
(147, NULL, '1423 Benton Blvd', '', NULL, NULL, 'United States', 'Georgia', NULL, NULL, 1, 0, '2025-02-02 00:00:00', '2025-02-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 12),
(148, NULL, '2126 Mayport Rd', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-15 00:00:00', '2025-06-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 13),
(149, NULL, '862 Mill Creek Road', '', NULL, NULL, 'United States', 'Maryland', NULL, NULL, 1, 0, '2025-05-22 00:00:00', '2025-05-22 00:00:00', NULL, NULL, NULL, NULL, NULL, 14),
(150, NULL, '10900 Central Port Drive', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-06 00:00:00', '2025-06-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 15),
(151, NULL, '300 Sanford Ave', '', NULL, '32771', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-27 00:00:00', '2025-03-27 00:00:00', NULL, NULL, NULL, NULL, NULL, 16),
(152, NULL, '301 Hospital Dr', '', NULL, '21061', 'United States', 'Maryland', NULL, NULL, 1, 0, '2024-05-28 00:00:00', '2024-05-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 17),
(153, NULL, '700 Bloom St', '', NULL, '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-11-11 00:00:00', '2022-11-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 18),
(154, NULL, '6675 Westwood Blvd', 'Suite #210', NULL, '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-04-24 00:00:00', '2023-04-24 00:00:00', NULL, NULL, NULL, NULL, NULL, 19),
(155, NULL, '6675 Westwood Blvd', 'Suite 210', NULL, '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-01-31 00:00:00', '2023-01-31 00:00:00', NULL, NULL, NULL, NULL, NULL, 20),
(156, NULL, '250 Industrial rd.', 'Gate 8', NULL, '39562', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2024-04-08 00:00:00', '2024-04-08 00:00:00', NULL, NULL, NULL, NULL, NULL, 21),
(157, NULL, '250 Industrial Rd', '', NULL, '39581', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2022-10-28 00:00:00', '2022-10-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 22),
(158, NULL, '8421 Baymeadows Way Ste 1', '', NULL, '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-13 00:00:00', '2025-03-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 23),
(159, NULL, '9560 VIA ENCINAS', '', NULL, '32830', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-17 00:00:00', '2022-02-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 24),
(160, NULL, '7400 International Drive', '', NULL, '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, NULL, NULL, NULL, NULL, 25),
(161, NULL, '6072 Sylvan Dr', '', NULL, '28037', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2024-09-30 00:00:00', '2024-09-30 00:00:00', NULL, NULL, NULL, NULL, NULL, 26),
(162, NULL, '4157 Seaboard Rd', '', NULL, '32808', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-06-06 00:00:00', '2022-06-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 27),
(163, NULL, '840 Mount Curve', '', NULL, '55116', 'United States', 'Minnesota', NULL, NULL, 1, 0, '2022-11-16 00:00:00', '2022-11-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 28),
(164, NULL, '2263 National Ave', '', NULL, '94545', 'United States', 'California', NULL, NULL, 1, 0, '2023-09-22 00:00:00', '2023-09-22 00:00:00', NULL, NULL, NULL, NULL, NULL, 29),
(165, NULL, '7731 tylers place blvd', '', NULL, '45069', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-03-17 00:00:00', '2025-03-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 30),
(166, NULL, '8686 Palm Pkwy', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 31),
(167, NULL, '140 South Ellis Road', '', 'Jacksonville', '32254', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 32),
(168, NULL, '310 Mill Creek Avenue', '', 'Pottsville', '17901', 'United States', 'Pennsylvania', NULL, NULL, 1, 0, '2025-03-04 00:00:00', '2025-03-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 33),
(169, NULL, '5510 S. Fort Apache Rd.', '', 'Las Vegas', '89148', 'United States', 'Nevada', NULL, NULL, 1, 0, '2025-04-01 00:00:00', '2025-04-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 34),
(170, NULL, '207 Laurel Avenue', '', 'Alton', '65606', 'United States', 'Missouri', NULL, NULL, 1, 0, '2025-04-15 00:00:00', '2025-04-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 35),
(171, NULL, '11246 Town View Dr.', 'Sales Center', 'Jacksonville', '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-10 00:00:00', '2025-05-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 36),
(172, NULL, '2900 Parkway Blvd.', '', 'Kissimmee', '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-01 00:00:00', '2025-06-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 37),
(173, NULL, '7676 W Lake Mead Blvd #100', '', 'Las Vegas', '89128', 'United States', 'Nevada', NULL, NULL, 1, 0, '2025-06-05 00:00:00', '2025-06-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 38),
(174, NULL, '8686 Palm Pkwy', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 39),
(175, NULL, '140 South Ellis Road', '', 'Jacksonville', '32254', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 40),
(176, NULL, '5780 Major Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-17 00:00:00', '2025-03-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 41),
(177, NULL, '304 W Colonial Drive', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-01 00:00:00', '2025-04-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 42),
(178, NULL, '11109 N 30th St', '', 'Tampa', '33612', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-10 00:00:00', '2025-05-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 43),
(179, NULL, '997 Blanding Blvd', 'Suite 4', 'Orange Park', '32065', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-06 00:00:00', '2025-06-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 44),
(180, NULL, '8250 Jamaican Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-01 00:00:00', '2025-07-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 45),
(181, NULL, '225 Shorecrest Drive', '', 'Altamonte Springs', '32701', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-02 00:00:00', '2025-07-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 46),
(182, NULL, '191 E Pine St', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-03 00:00:00', '2025-07-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 47),
(183, NULL, '721 Ballough Rd', '', 'Daytona Beach', '32114', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-04 00:00:00', '2025-07-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 48),
(184, NULL, '301 West Bay Street', 'Suite 1400', 'Jacksonville', '32202', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-28 00:00:00', '2025-02-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 49),
(185, NULL, '525 N. 7th Street', '#Ofc', 'San Jose', '95112', 'United States', 'California', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-01-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 50),
(186, NULL, '7100 Augusta National Dr', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-12 00:00:00', '2025-03-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 51),
(187, NULL, '12191 S. Apopka Vineland RD', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-12 00:00:00', '2025-03-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 52),
(188, NULL, '5561 Alpine Drive', '', 'Summerville', '29384', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-04-05 00:00:00', '2025-04-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 53),
(189, NULL, '5005 Kyngs Heath Rd', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-18 00:00:00', '2025-05-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 54),
(190, NULL, '4429 N John Young Parkway', '', 'Orlando', '32804', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-20 00:00:00', '2025-06-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 55),
(191, NULL, '1600 Main St', '', 'Peninsula', '44264', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-06-25 00:00:00', '2025-06-25 00:00:00', NULL, NULL, NULL, NULL, NULL, 56),
(192, NULL, '5905 International Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-29 00:00:00', '2025-06-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 57),
(193, NULL, '425 Highland Ave', '', 'Augusta', '30909', 'United States', 'Georgia', NULL, NULL, 1, 0, '2023-01-23 00:00:00', '2023-01-23 00:00:00', NULL, NULL, NULL, NULL, NULL, 58),
(194, NULL, '155 West 23rd Street', '', 'New York', '10011', 'United States', 'New York', NULL, NULL, 1, 0, '2022-03-11 00:00:00', '2022-03-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 59),
(195, NULL, 'PO BOX 1773', '', 'Sonoma', '95476', 'United States', 'California', NULL, NULL, 1, 0, '2023-02-01 00:00:00', '2023-02-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 60),
(196, NULL, '3640 Mossy Creek Lane', '', 'Tallahassee', '32311', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-28 00:00:00', '2025-04-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 61),
(197, NULL, '1861 bunches chapel road', '', 'Parsons', '38363', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2023-12-28 00:00:00', '2023-12-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 62),
(198, NULL, '3703 INDUSTRIAL RD', '', 'PASCAGOULA', '39581', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2023-07-12 00:00:00', '2023-07-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 63),
(199, NULL, '5800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-28 00:00:00', '2025-07-16 15:09:04', NULL, NULL, NULL, NULL, NULL, 64),
(200, NULL, '429 North Main Street', '', 'Sheboygan Falls', '53085', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2023-09-20 00:00:00', '2023-09-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 65),
(201, NULL, '8505 South Kirkman Road', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-21 00:00:00', '2025-04-21 00:00:00', NULL, NULL, NULL, NULL, NULL, 66),
(202, NULL, '1959 North Alafaya Trail', '', 'Orlando', '32826', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-10-07 00:00:00', '2024-10-07 00:00:00', NULL, NULL, NULL, NULL, NULL, 67),
(203, NULL, '5916 Caravan Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-09-29 00:00:00', '2023-09-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 68),
(204, NULL, '13351 State Road 535', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-16 00:00:00', '2025-06-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 69),
(205, NULL, '7800 Universal Boulevard', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-17 00:00:00', '2025-06-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 70),
(206, NULL, '7800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-30 16:57:23', '2025-06-30 16:57:23', NULL, NULL, NULL, NULL, NULL, 71),
(207, NULL, '7800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-01 09:00:00', '2025-07-01 09:00:00', NULL, NULL, NULL, NULL, NULL, 72),
(208, NULL, '601 Front Street', '', 'Key West', '33040', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-01-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 73),
(209, NULL, '5472 Gateway Village Circle', '', 'Orlando', '32812', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-20 00:00:00', '2025-02-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 74),
(210, NULL, '5940 Caravan Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-10 00:00:00', '2025-03-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 75),
(211, NULL, '5976 Caravan Court', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-05 00:00:00', '2025-04-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 76),
(212, NULL, '8741 International Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-06-06 00:00:00', '2023-06-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 77),
(213, NULL, '50 Alhambra Plaza', '', 'Coral Gables', '33134', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-06-06 00:00:00', '2023-06-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 78),
(214, NULL, 'ONE GRAND CYPRESS BLVD', '', 'ORLANDO', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, NULL, NULL, NULL, NULL, 79),
(215, NULL, '9801 INTERNATIONAL DRIVE', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-10-11 00:00:00', '2023-10-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 80),
(216, NULL, '3033 Newcastle Loop', '', 'Myrtle Beach', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-07 00:00:00', '2025-02-07 00:00:00', NULL, NULL, NULL, NULL, NULL, 81),
(217, NULL, '117 N Elm STreet', '', 'COLUMBIA', '27925', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2022-06-12 00:00:00', '2022-06-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 82),
(218, NULL, '25 N Main Street', 'Suite G', 'Moncks Corner', '29461', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2022-02-21 00:00:00', '2022-02-21 00:00:00', NULL, NULL, NULL, NULL, NULL, 83),
(219, NULL, '227 Stallsville Loop', 'Ste A', 'Summerville', '29485', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-27 00:00:00', '2025-02-27 00:00:00', NULL, NULL, NULL, NULL, NULL, 84),
(220, NULL, '227 Stallsville Loop', 'Suite A', 'Summerville', '29485', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2023-03-21 00:00:00', '2023-03-21 00:00:00', NULL, NULL, NULL, NULL, NULL, 85),
(221, NULL, '2134 Center Way', '', 'Middleburg', '32068', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-02 00:00:00', '2025-06-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 86),
(222, NULL, '985 Charles Lindbergh Dr', '', 'jacksonville', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-29 00:00:00', '2025-05-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 87),
(223, NULL, '11107 ATLANTIC BLVD', '', 'JACKSONVILLE', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-10 00:00:00', '2025-03-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 88),
(224, NULL, '9301 Lake Nona Blvd', '', 'Orlando', '32827', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-10 00:00:00', '2025-01-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 89),
(225, NULL, '7220 Financial Way, Jacksonville, FL 32256', '', 'Jacksonville', '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-11 00:00:00', '2025-01-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 90),
(226, NULL, '17777 Bali Blvd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-12 00:00:00', '2025-01-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 91),
(227, NULL, '6800 Lakewood Plaza Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-13 00:00:00', '2025-01-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 92),
(228, NULL, '3101 Shelby Industrial Drive', '', 'Apopka', '32703', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-14 00:00:00', '2025-01-14 00:00:00', NULL, NULL, NULL, NULL, NULL, 93),
(229, NULL, '6300 Hollywood Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-01-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 94),
(230, NULL, '6300 Hollywood Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-16 00:00:00', '2025-01-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 95),
(231, NULL, '6601 Adventure Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-17 00:00:00', '2025-01-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 96),
(232, NULL, '721 Ballough Rd.', '', 'Daytona', '32114', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-18 00:00:00', '2025-01-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 97),
(233, NULL, '901 Maxwell St', '', 'Lake Geneva', '53147', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-01-19 00:00:00', '2025-01-19 00:00:00', NULL, NULL, NULL, NULL, NULL, 98),
(234, NULL, '4810 West Irlo Bronson Memorial Hwy', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:01:00', NULL, NULL, NULL, NULL, NULL, 99),
(235, NULL, '1200 Riverplace Blvd', 'Ste 800', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-21 00:00:00', '2025-01-21 00:00:00', NULL, NULL, NULL, NULL, NULL, 100),
(236, NULL, '11251 Harbour Villa Rd', 'Engineering', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-22 00:00:00', '2025-01-22 00:00:00', NULL, NULL, NULL, NULL, NULL, 101),
(237, NULL, '7102 Grand Horizons Blvd', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-23 00:00:00', '2025-01-23 00:00:00', NULL, NULL, NULL, NULL, NULL, 102),
(238, NULL, '9301 Lake Nona Blvd', '', 'Orlando', '32827', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-24 00:00:00', '2025-01-24 00:00:00', NULL, NULL, NULL, NULL, NULL, 103),
(239, NULL, '555 Hazeltine National Dr', '', 'Orlando', '32812', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-25 00:00:00', '2025-01-25 00:00:00', NULL, NULL, NULL, NULL, NULL, 104),
(240, NULL, '1816 E Colonial Dr', '', 'Orlando', '32803', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-26 00:00:00', '2025-01-26 00:00:00', NULL, NULL, NULL, NULL, NULL, 105),
(241, NULL, '8926 International Dr', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-27 00:00:00', '2025-01-27 00:00:00', NULL, NULL, NULL, NULL, NULL, 106),
(242, NULL, '10100 International Drive', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-28 00:00:00', '2025-01-28 00:00:00', NULL, NULL, NULL, NULL, NULL, 107),
(243, NULL, '4600 South Ocean Blvd', '', 'Highland Beach', '33455', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-29 00:00:00', '2025-01-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 108),
(244, NULL, '1606 Erie Ave', '', 'Sheboygan', '53081', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-01-30 00:00:00', '2025-01-30 00:00:00', NULL, NULL, NULL, NULL, NULL, 109),
(245, NULL, '1501 International Pkwy', '', 'Kissimmee', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-31 00:00:00', '2025-01-31 00:00:00', NULL, NULL, NULL, NULL, NULL, 110),
(246, NULL, '3090 Michigan Ave.', '', 'Kissimmee', '34744', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-01 00:00:00', '2025-02-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 111),
(247, NULL, '2400 NE 12th St', '', 'Pompano Beach', '33062', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-02 00:00:00', '2025-02-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 112),
(248, NULL, '1730 University Blvd', '', 'Albuquerque', '87106', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2025-02-03 00:00:00', '2025-02-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 113),
(249, NULL, '1 Clubhouse Dr', '', 'Sandia Park', '87047', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2025-02-04 00:00:00', '2025-02-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 114),
(250, NULL, '1500 N Thacker Ave', '', 'Kissimmee', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-05 00:00:00', '2025-02-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 115),
(251, NULL, '3505 N Hwy 1792', '', 'Longwood', '32750', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-06 00:00:00', '2025-02-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 116),
(252, NULL, '102 Maple Forest Ct.', '', 'Hendersonville', '37075', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2025-02-07 00:00:00', '2025-02-07 00:00:00', NULL, NULL, NULL, NULL, NULL, 117),
(253, NULL, '215 Looney Rd', '', 'Piqua', '45356', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-02-08 00:00:00', '2025-02-08 00:00:00', NULL, NULL, NULL, NULL, NULL, 118),
(254, NULL, '36900 Harper', '', 'Clinton Township', '48035', 'United States', 'Michigan', NULL, NULL, 1, 0, '2025-02-09 00:00:00', '2025-02-09 00:00:00', NULL, NULL, NULL, NULL, NULL, 119),
(255, NULL, '5905 Kirkman Road', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-10 00:00:00', '2025-02-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 120),
(256, NULL, '19910 W 161st Street', '', 'Olathe', '66062', 'United States', 'Kansas', NULL, NULL, 1, 0, '2025-02-11 00:00:00', '2025-02-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 121),
(257, NULL, '5601 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-12 00:00:00', '2025-02-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 122),
(279, NULL, '4110 Southpoint Boulevard', 'Suite 100', 'Jacksonville', '32216', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 123),
(280, NULL, '3316 Platt Springs Rd', '', 'West Columbia', '29170', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, NULL, NULL, NULL, NULL, 124),
(281, NULL, '13279 Hartzog Rd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 125),
(282, NULL, '11107 Atlantic Blvd', '', 'Jacksonville', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 126),
(283, NULL, '2717 Fowler Ave', '', 'Memphis', '38112', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 127),
(284, NULL, '8451 International Dr', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-18 00:00:00', '2025-02-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 128),
(285, NULL, '3333 N Atlantic Ave', '', 'Daytona Beach', '33404', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-19 00:00:00', '2025-02-19 00:00:00', NULL, NULL, NULL, NULL, NULL, 129),
(286, NULL, '12724 Gran Bay Parkway West Suite 200', '', 'Jacksonville', '32258', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 130),
(287, NULL, '12724 Gran Bay Pkwy W', 'Ste 200', 'Jacksonville', '32258', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 131),
(288, NULL, '137 Concord Drive', 'Suite 1101', 'Casselberry', '32707', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, NULL, NULL, NULL, NULL, 132),
(289, NULL, '5561 Alpine Drive', '', 'Summerville', '29483', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, NULL, NULL, NULL, NULL, 133),
(290, NULL, '3563 Philips Highway', 'Suite F-601', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 134),
(291, NULL, '1000 Riverside Ave Unit #100', '', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 135),
(292, NULL, '1000 Riverside Ave', '', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 136),
(293, NULL, '1000 Riverside Ave', 'Suite 100', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 137),
(294, NULL, '7703 Kingspointe Pkwy', '#300', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 138),
(295, NULL, '16192 Aspen Ln', '', 'Biloxi', '39532', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 139),
(296, NULL, '1200 Rinehart Rd', '', 'Sanford', '32771', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, NULL, NULL, NULL, NULL, 140),
(297, NULL, '1989 Front St', '', 'Cuyahoga Falls', '44221', 'United States', 'Ohio', NULL, NULL, 1, 0, '2023-06-18 00:00:00', '2023-06-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 141),
(298, NULL, 'Augusta National Dr', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-08-29 00:00:00', '2022-08-29 00:00:00', NULL, NULL, NULL, NULL, NULL, 142),
(299, NULL, '8800 Vistana Centre Drive', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-22 00:00:00', '2022-03-22 00:00:00', NULL, NULL, NULL, NULL, NULL, 143),
(300, NULL, '501 Vineland Road', '', 'Orlando', '32811', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-03 00:00:00', '2022-03-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 144),
(301, NULL, '410 Caring Drive', '', 'Lake Mary', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-02-13 00:00:00', '2023-02-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 145),
(302, NULL, '240 Battleground Road', '', 'Kings Mountain', '28086', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2023-03-06 00:00:00', '2023-03-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 146),
(303, NULL, '4110 Southpoint Boulevard', 'Suite 100', 'Jacksonville', '32216', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-11-03 00:00:00', '2023-11-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 147),
(304, NULL, '3316 Platt Springs Rd', '', 'West Columbia', '29170', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2022-06-02 00:00:00', '2022-06-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 148),
(305, NULL, '13279 Hartzog Rd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-03-04 00:00:00', '2024-03-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 149),
(306, NULL, '5876 West Irlo Bronson Memorial Highway', '', 'Kissimmee', '34743', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-05-30 00:00:00', '2023-05-30 00:00:00', NULL, NULL, NULL, NULL, NULL, 150),
(307, NULL, '404 Village Drive', '', 'Kissimmee', '34759', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-15 00:00:00', '2022-02-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 151),
(308, NULL, '301 W Bay St', 'Suite 2600', 'Jacksonville', '32202', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-12-08 00:00:00', '2022-12-08 00:00:00', NULL, NULL, NULL, NULL, NULL, 152),
(309, NULL, '333 South Delaware Street', '', 'Indianapolis', '46204', 'United States', 'Indiana', NULL, NULL, 1, 0, '2022-11-18 00:00:00', '2022-11-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 153),
(310, NULL, '1301 Riverplace Blvd, ', 'Suite 2700', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-19 00:00:00', '2022-01-19 00:00:00', NULL, NULL, NULL, NULL, NULL, 154),
(311, NULL, '1875 N SANDUSKY AVE', '', 'BUCYRUS', '44820-1337', 'United States', 'Ohio', NULL, NULL, 1, 0, '2022-05-23 00:00:00', '2022-05-23 00:00:00', NULL, NULL, NULL, NULL, NULL, 155),
(312, NULL, '600 N Atlantic Ave', '', 'Daytona Beach', '32118', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-19 00:00:00', '2022-01-19 00:00:00', NULL, NULL, NULL, NULL, NULL, 156),
(313, NULL, '7389 Universal BLVD', '', 'ORLANDO', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-09-23 00:00:00', '2024-09-23 00:00:00', NULL, NULL, NULL, NULL, NULL, 157),
(314, NULL, '316 Live Oaks Blvd', '', 'Cassellberry', '32707', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-15 00:00:00', '2022-03-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 158),
(315, NULL, '6211 Ocean Ave', '', 'Wildwood Crest', '8260', 'United States', 'New Jersey', NULL, NULL, 1, 0, '2024-06-21 00:00:00', '2024-06-21 00:00:00', NULL, NULL, NULL, NULL, NULL, 159),
(316, NULL, '123 Auto Auto least and sales', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-01 00:00:00', '2024-01-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 160),
(317, NULL, '200 Tom Batchelor', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-02 00:00:00', '2024-01-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 161),
(318, NULL, '314 Town Center', '', 'Casselberry', '32714', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-03 00:00:00', '2024-01-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 162),
(319, NULL, '100 Susan St', '', 'Winter Park', '33000', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-04 00:00:00', '2024-01-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 163),
(320, NULL, '500 Machado Blvd', '', 'Los Angeles', '12345', 'United States', 'California', NULL, NULL, 1, 0, '2024-01-05 00:00:00', '2024-01-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 164),
(321, NULL, '789 Waters Rd', '', 'Phoenix', '85001', 'United States', 'Arizona', NULL, NULL, 1, 0, '2024-01-06 00:00:00', '2024-01-06 00:00:00', NULL, NULL, NULL, NULL, NULL, 165),
(322, NULL, '132 Truvillion St', '', 'New York', '10001', 'United States', 'New York', NULL, NULL, 1, 0, '2024-01-07 00:00:00', '2024-01-07 00:00:00', NULL, NULL, NULL, NULL, NULL, 166),
(323, NULL, '321 Maxon Ave', '', 'Hartford', '53000', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2024-01-08 00:00:00', '2024-01-08 00:00:00', NULL, NULL, NULL, NULL, NULL, 167),
(324, NULL, '219 Ward Dr', '', 'Lyndhurst', '07086', 'United States', 'New Jersey', NULL, NULL, 1, 0, '2024-01-09 00:00:00', '2024-01-09 00:00:00', NULL, NULL, NULL, NULL, NULL, 168),
(325, NULL, '47 Ferrara Lane', '', 'New York', '10002', 'United States', 'New York', NULL, NULL, 1, 0, '2024-01-10 00:00:00', '2024-01-10 00:00:00', NULL, NULL, NULL, NULL, NULL, 169),
(326, NULL, '88 Mortuary Blvd', '', 'Dania Beach', '33051', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-11 00:00:00', '2024-01-11 00:00:00', NULL, NULL, NULL, NULL, NULL, 170),
(327, NULL, '123 Patricia St', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-12 00:00:00', '2024-01-12 00:00:00', NULL, NULL, NULL, NULL, NULL, 171),
(328, NULL, '45 Eberle Ct', '', 'Orlando', '32825', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-13 00:00:00', '2024-01-13 00:00:00', NULL, NULL, NULL, NULL, NULL, 172),
(329, NULL, '159 Lopez Rd', '', 'Apopka', '32703', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-14 00:00:00', '2024-01-14 00:00:00', NULL, NULL, NULL, NULL, NULL, 173),
(330, NULL, '111 Davis Ave', '', 'Jacksonville', '32255', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-15 00:00:00', '2024-01-15 00:00:00', NULL, NULL, NULL, NULL, NULL, 174),
(331, NULL, '200 Jamison Blvd', '', 'Orlando', '32826', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-16 00:00:00', '2024-01-16 00:00:00', NULL, NULL, NULL, NULL, NULL, 175),
(332, NULL, '302 Sanchez St', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-17 00:00:00', '2024-01-17 00:00:00', NULL, NULL, NULL, NULL, NULL, 176),
(333, NULL, '404 Fleming Rd', '', 'Miami', '33063', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-18 00:00:00', '2024-01-18 00:00:00', NULL, NULL, NULL, NULL, NULL, 177),
(334, NULL, '516 Layug Blvd', '', 'Hialeah', '33013', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-19 00:00:00', '2024-01-19 00:00:00', NULL, NULL, NULL, NULL, NULL, 178),
(335, NULL, '617 Mussolino Drive', '', 'Kissimmee', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-20 00:00:00', '2024-01-20 00:00:00', NULL, NULL, NULL, NULL, NULL, 179),
(336, NULL, '3011 Maingate Lane', '', 'Kissimmee', '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-01 00:00:00', '2024-02-01 00:00:00', NULL, NULL, NULL, NULL, NULL, 180),
(337, NULL, '5324 Fairfield Lake Dr.', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-02 00:00:00', '2024-02-02 00:00:00', NULL, NULL, NULL, NULL, NULL, 181),
(338, NULL, '1850 Hotel Plaza Blvd', '', 'Lake Buena Vista', '32830', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-03 00:00:00', '2024-02-03 00:00:00', NULL, NULL, NULL, NULL, NULL, 182),
(339, NULL, '200 S Orange Ave', 'Suite 2700', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-04 00:00:00', '2024-02-04 00:00:00', NULL, NULL, NULL, NULL, NULL, 183),
(340, NULL, '11109 North 30th Street', '', 'Tampa', '33612', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-05 00:00:00', '2024-02-05 00:00:00', NULL, NULL, NULL, NULL, NULL, 184),
(341, 'shipping address 10', 'address line 1 20', 'address line 2 30', 'South Miami', '1234', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-03 06:26:27', '2025-07-03 06:26:27', NULL, NULL, NULL, NULL, NULL, 185),
(342, '7400 International Drive', '7400 International Drive', '', NULL, '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, NULL, NULL, NULL, NULL, 186),
(343, 'company', 'lhr4567890', 'hgrtdgfjh', 'Lahoreg', '51000gggggggg', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-03 13:56:32', '2025-07-03 13:56:32', NULL, NULL, NULL, NULL, NULL, 188),
(344, 'qefrgeth', '3wqte4y5e6u`', '14wt5ye6ur7tiyluo', '3245364231w42r5t64', '65trdf', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-07-03 14:35:52', '2025-07-03 14:35:52', NULL, NULL, NULL, NULL, NULL, 190),
(345, 'company one', 'addr 1', 'addr 2', 'Lahore1', '51000', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-07-03 14:52:06', '2025-07-03 14:52:06', NULL, NULL, NULL, NULL, NULL, 191),
(346, '1141 Cainhoy Rd', 'Warehouse 1', 'Warehouse 1', 'Charleston ', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-03 16:22:55', '2025-07-03 16:22:55', NULL, NULL, NULL, NULL, NULL, 195),
(347, 'Allfor care Services Ltd. ', '8 clifton Road', '', 'southall ', 'HA3 9NS', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-04 08:23:29', '2025-07-16 09:21:11', NULL, NULL, NULL, NULL, NULL, 196),
(348, 'asf', 'sdfgtr', 'weretr', 'efee', 'fretr', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-07-04 13:51:24', '2025-07-04 13:51:24', NULL, NULL, NULL, NULL, NULL, 197),
(349, 'test', 'test', 'test', 'Test', 'Test5400', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-07 09:14:39', '2025-07-07 09:14:39', NULL, NULL, NULL, NULL, NULL, 186),
(350, 'test2', 'test2', 'test2', 'test2', 'test2100', 'United States', 'Texas', NULL, NULL, 1, 0, '2025-07-07 09:18:02', '2025-07-07 09:18:02', NULL, NULL, NULL, NULL, NULL, 186),
(351, 'company demo address', 'adddress line 1 demo', 'address line 2 demo', 'miami 24', '1234', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-07 09:34:24', '2025-07-21 12:09:46', NULL, NULL, NULL, NULL, NULL, 198),
(352, '5667', 'rfrfe', 'rerfrefrefrefr', 'lahore', '47', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-07-07 15:48:30', '2025-07-07 15:48:30', NULL, NULL, NULL, NULL, NULL, 196),
(353, '	Innovative Endodontics MB', '3033 NEWCASTLE LOOP', '', 'Myrtle Beach', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-07 17:20:50', '2025-07-07 17:20:50', NULL, NULL, NULL, NULL, NULL, 199),
(354, 'dfghjklcd', 'dfsxvdcsx', 'dcsxvdcxsdc', 'Inglis', '1234', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-08 04:31:03', '2025-07-08 04:31:03', NULL, NULL, NULL, NULL, NULL, 198),
(355, 'Orlando Marriott Lake Mary', '1501 International Pkwy ', '', 'Lake Mary', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-14 11:15:23', '2025-07-14 11:15:23', NULL, NULL, NULL, NULL, NULL, 200),
(356, 'Marriott\'s Harbour Lake', '7102 Grand horizons blvd', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 06:13:06', '2025-07-16 06:13:06', NULL, NULL, NULL, NULL, NULL, 201),
(357, 'Park Royal', '1500 N Thacker Ave ', '', 'Kissimmee', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 06:54:38', '2025-07-16 06:54:38', NULL, NULL, NULL, NULL, NULL, 202),
(358, 'Portofino Bay', '5601 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 10:12:40', '2025-07-16 10:12:40', NULL, NULL, NULL, NULL, NULL, 203),
(359, 'Hilton Melbourne Beach', '3003 N HWY A1A', '', 'Indialantic', '32903', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 11:09:47', '2025-07-16 11:09:47', NULL, NULL, NULL, NULL, NULL, 204),
(360, 'Loews Royal Pacific Resort', '6300 HOLLYWOOD WAY', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 15:19:07', '2025-07-16 15:19:07', NULL, NULL, NULL, NULL, NULL, 205),
(361, 'Azhar 99 shipping', 'lhr1', 'hgrtdgfjh', 'Lahore', '51000', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 08:04:17', '2025-07-17 08:04:17', NULL, NULL, NULL, NULL, NULL, 206),
(362, 'bbb', 'lhr1', 'hgrtdgfjh', 'Lahore', '51000', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 11:12:25', '2025-07-17 11:12:25', NULL, NULL, NULL, NULL, NULL, 207),
(363, 'aaaa', 'aaa', 'aaa', 'aaa', 'aaa', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 11:15:57', '2025-07-17 11:15:57', NULL, NULL, NULL, NULL, NULL, 209),
(364, '1141 Cainhoy Rd', 'Warehouse 1', 'Warehouse 1', 'Charleston', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-17 15:12:51', '2025-07-17 15:12:51', NULL, NULL, NULL, NULL, NULL, 212),
(365, 'PARK ROYAL', '1500 N THACKER AVE', '', 'KISSIMMEE', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-18 01:44:57', '2025-07-18 01:44:57', NULL, NULL, NULL, NULL, NULL, 213),
(366, 'Pool Service Pros', 'Warehouse 1', 'Warehouse 1', 'Charleston', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-18 17:37:28', '2025-07-18 17:37:28', NULL, NULL, NULL, NULL, NULL, 220),
(367, 'Innovative Endodontics MB', '3033 NEWCASTLE LOOP', 'Warehouse 1', 'MYRTLE BEACH', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-21 17:36:26', '2025-07-21 17:36:26', NULL, NULL, NULL, NULL, NULL, 225);

-- --------------------------------------------------------

--
-- Table structure for table `billingAddresses`
--

CREATE TABLE `billingAddresses` (
  `id` int(11) NOT NULL,
  `addressLineOne` varchar(255) DEFAULT NULL,
  `addressLineTwo` varchar(255) DEFAULT NULL,
  `town` varchar(255) DEFAULT NULL,
  `zipCode` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `lat` varchar(255) DEFAULT NULL,
  `lng` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `companyaddress` varchar(255) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `billingAddresses`
--

INSERT INTO `billingAddresses` (`id`, `addressLineOne`, `addressLineTwo`, `town`, `zipCode`, `country`, `state`, `lat`, `lng`, `status`, `deleted`, `createdAt`, `updatedAt`, `deletedAt`, `userId`, `companyaddress`) VALUES
(136, '8010 Sunport Drive Ste 122', '', 'ORLANDO', '32809', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-20 00:00:00', '2025-03-20 00:00:00', NULL, 1, ''),
(137, '479 West Eads Parkway', '', 'Lawrenceberg', '47025', 'United States', 'Indiana', NULL, NULL, 1, 0, '2023-10-30 00:00:00', '2023-10-30 00:00:00', NULL, 2, ''),
(138, '21120 US Hwy 84', '', 'Abiquiu', '87510', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2023-02-22 00:00:00', '2023-02-22 00:00:00', NULL, 3, ''),
(139, '2852 wild orchid ct', '', 'Naples', '34119', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-04-09 00:00:00', '2023-04-09 00:00:00', NULL, 4, ''),
(140, '1100 WEST GRAND RIVER AVE', '', 'WILLIAMSTON', '48895', 'United States', 'Michigan', NULL, NULL, 1, 0, '2023-01-04 00:00:00', '2023-01-04 00:00:00', NULL, 5, ''),
(141, '202 Lincoln St', '', 'Dothan', '36303', 'United States', 'Alabama', NULL, NULL, 1, 0, '2025-02-27 00:00:00', '2025-02-27 00:00:00', NULL, 6, ''),
(142, '4812 Deer Lake Dr W', '', 'Jacksonville', '32246', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-05-29 00:00:00', '2024-05-29 00:00:00', NULL, 7, ''),
(143, '5730 central Florida pkwy', '', 'orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-11-03 00:00:00', '2023-11-03 00:00:00', NULL, 8, ''),
(144, '15220 NE Shen St Suite 150', '', 'Redmond, WA', '98052', 'United States', 'Washington', NULL, NULL, 1, 0, '2024-10-30 00:00:00', '2024-10-30 00:00:00', NULL, 9, ''),
(145, '751 Skymarks Dr', '', 'Jacksonville', '32218', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-17 00:00:00', '2024-01-17 00:00:00', NULL, 10, ''),
(146, '7215 Corner Drive', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-10 00:00:00', '2025-06-10 00:00:00', NULL, 11, ''),
(147, '1423 Benton Blvd', '', NULL, NULL, 'United States', 'Georgia', NULL, NULL, 1, 0, '2025-02-02 00:00:00', '2025-02-02 00:00:00', NULL, 12, ''),
(148, '2126 Mayport Rd', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-15 00:00:00', '2025-06-15 00:00:00', NULL, 13, ''),
(149, '862 Mill Creek Road', '', NULL, NULL, 'United States', 'Maryland', NULL, NULL, 1, 0, '2025-05-22 00:00:00', '2025-05-22 00:00:00', NULL, 14, ''),
(150, '10900 Central Port Drive', '', NULL, NULL, 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-06 00:00:00', '2025-06-06 00:00:00', NULL, 15, ''),
(151, '300 Sanford Ave', '', NULL, '32771', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-27 00:00:00', '2025-03-27 00:00:00', NULL, 16, ''),
(152, '301 Hospital Dr', '', NULL, '21061', 'United States', 'Maryland', NULL, NULL, 1, 0, '2024-05-28 00:00:00', '2024-05-28 00:00:00', NULL, 17, ''),
(153, '700 Bloom St', '', NULL, '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-11-11 00:00:00', '2022-11-11 00:00:00', NULL, 18, ''),
(154, '6675 Westwood Blvd', 'Suite #210', NULL, '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-04-24 00:00:00', '2023-04-24 00:00:00', NULL, 19, ''),
(155, '6675 Westwood Blvd', 'Suite 210', NULL, '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-01-31 00:00:00', '2023-01-31 00:00:00', NULL, 20, ''),
(156, '250 Industrial rd.', 'Gate 8', NULL, '39562', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2024-04-08 00:00:00', '2024-04-08 00:00:00', NULL, 21, ''),
(157, '250 Industrial Rd', '', NULL, '39581', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2022-10-28 00:00:00', '2022-10-28 00:00:00', NULL, 22, ''),
(158, '8421 Baymeadows Way Ste 1', '', NULL, '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-13 00:00:00', '2025-03-13 00:00:00', NULL, 23, ''),
(159, '9560 VIA ENCINAS', '', NULL, '32830', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-17 00:00:00', '2022-02-17 00:00:00', NULL, 24, ''),
(160, '7400 International Drive', '', NULL, '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, 25, ''),
(161, '6072 Sylvan Dr', '', NULL, '28037', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2024-09-30 00:00:00', '2024-09-30 00:00:00', NULL, 26, ''),
(162, '4157 Seaboard Rd', '', NULL, '32808', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-06-06 00:00:00', '2022-06-06 00:00:00', NULL, 27, ''),
(163, '840 Mount Curve', '', NULL, '55116', 'United States', 'Minnesota', NULL, NULL, 1, 0, '2022-11-16 00:00:00', '2022-11-16 00:00:00', NULL, 28, ''),
(164, '2263 National Ave', '', NULL, '94545', 'United States', 'California', NULL, NULL, 1, 0, '2023-09-22 00:00:00', '2023-09-22 00:00:00', NULL, 29, ''),
(165, '7731 tylers place blvd', '', NULL, '45069', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-03-17 00:00:00', '2025-03-17 00:00:00', NULL, 30, ''),
(166, '8686 Palm Pkwy', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, 31, ''),
(167, '140 South Ellis Road', '', 'Jacksonville', '32254', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:00:00', NULL, 32, ''),
(168, '310 Mill Creek Avenue', '', 'Pottsville', '17901', 'United States', 'Pennsylvania', NULL, NULL, 1, 0, '2025-03-04 00:00:00', '2025-03-04 00:00:00', NULL, 33, ''),
(169, '5510 S. Fort Apache Rd.', '', 'Las Vegas', '89148', 'United States', 'Nevada', NULL, NULL, 1, 0, '2025-04-01 00:00:00', '2025-04-01 00:00:00', NULL, 34, ''),
(170, '207 Laurel Avenue', '', 'Alton', '65606', 'United States', 'Missouri', NULL, NULL, 1, 0, '2025-04-15 00:00:00', '2025-04-15 00:00:00', NULL, 35, ''),
(171, '11246 Town View Dr.', 'Sales Center', 'Jacksonville', '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-10 00:00:00', '2025-05-10 00:00:00', NULL, 36, ''),
(172, '2900 Parkway Blvd.', '', 'Kissimmee', '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-01 00:00:00', '2025-06-01 00:00:00', NULL, 37, ''),
(173, '7676 W Lake Mead Blvd #100', '', 'Las Vegas', '89128', 'United States', 'Nevada', NULL, NULL, 1, 0, '2025-06-05 00:00:00', '2025-06-05 00:00:00', NULL, 38, ''),
(174, '8686 Palm Pkwy', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, 39, ''),
(175, '140 South Ellis Road', '', 'Jacksonville', '32254', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:00:00', NULL, 40, ''),
(176, '5780 Major Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-17 00:00:00', '2025-03-17 00:00:00', NULL, 41, ''),
(177, '304 W Colonial Drive', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-01 00:00:00', '2025-04-01 00:00:00', NULL, 42, ''),
(178, '11109 N 30th St', '', 'Tampa', '33612', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-10 00:00:00', '2025-05-10 00:00:00', NULL, 43, ''),
(179, '997 Blanding Blvd', 'Suite 4', 'Orange Park', '32065', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-06 00:00:00', '2025-06-06 00:00:00', NULL, 44, ''),
(180, '8250 Jamaican Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-01 00:00:00', '2025-07-01 00:00:00', NULL, 45, ''),
(181, '225 Shorecrest Drive', '', 'Altamonte Springs', '32701', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-02 00:00:00', '2025-07-02 00:00:00', NULL, 46, ''),
(182, '191 E Pine St', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-03 00:00:00', '2025-07-03 00:00:00', NULL, 47, ''),
(183, '721 Ballough Rd', '', 'Daytona Beach', '32114', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-04 00:00:00', '2025-07-04 00:00:00', NULL, 48, ''),
(184, '301 West Bay Street', 'Suite 1400', 'Jacksonville', '32202', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-28 00:00:00', '2025-02-28 00:00:00', NULL, 49, ''),
(185, '11109 North 30th Street', '2222', '', '33612', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-07-10 07:21:44', NULL, 50, 'aaaaa'),
(186, '7100 Augusta National Dr', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-12 00:00:00', '2025-03-12 00:00:00', NULL, 51, ''),
(187, '12191 S. Apopka Vineland RD', '', 'Orlando', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-12 00:00:00', '2025-03-12 00:00:00', NULL, 52, ''),
(188, '5561 Alpine Drive', '', 'Summerville', '29384', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-04-05 00:00:00', '2025-04-05 00:00:00', NULL, 53, ''),
(189, '5005 Kyngs Heath Rd', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-18 00:00:00', '2025-05-18 00:00:00', NULL, 54, ''),
(190, '4429 N John Young Parkway', '', 'Orlando', '32804', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-20 00:00:00', '2025-06-20 00:00:00', NULL, 55, ''),
(191, '1600 Main St', '', 'Peninsula', '44264', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-06-25 00:00:00', '2025-06-25 00:00:00', NULL, 56, ''),
(192, '5905 International Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-29 00:00:00', '2025-06-29 00:00:00', NULL, 57, ''),
(193, '425 Highland Ave', '', 'Augusta', '30909', 'United States', 'Georgia', NULL, NULL, 1, 0, '2023-01-23 00:00:00', '2023-01-23 00:00:00', NULL, 58, ''),
(194, '155 West 23rd Street', '', 'New York', '10011', 'United States', 'New York', NULL, NULL, 1, 0, '2022-03-11 00:00:00', '2022-03-11 00:00:00', NULL, 59, ''),
(195, 'PO BOX 1773', '', 'Sonoma', '95476', 'United States', 'California', NULL, NULL, 1, 0, '2023-02-01 00:00:00', '2023-02-01 00:00:00', NULL, 60, ''),
(196, 'Allfor care Services Ltd.', NULL, 'southall ', 'HA3 9NS', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-04-28 00:00:00', '2025-07-16 09:21:07', NULL, 61, 'bolling demo address'),
(197, '1861 bunches chapel road', '', 'Parsons', '38363', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2023-12-28 00:00:00', '2023-12-28 00:00:00', NULL, 62, ''),
(198, 'company demo address', NULL, 'miami 32', '1234', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-07-12 00:00:00', '2025-07-21 12:09:57', NULL, 63, ''),
(199, '5800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-28 00:00:00', '2022-02-28 00:00:00', NULL, 64, ''),
(200, '429 North Main Street', '', 'Sheboygan Falls', '53085', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2023-09-20 00:00:00', '2023-09-20 00:00:00', NULL, 65, ''),
(201, '8505 South Kirkman Road', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-21 00:00:00', '2025-04-21 00:00:00', NULL, 66, ''),
(202, '1959 North Alafaya Trail', '', 'Orlando', '32826', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-10-07 00:00:00', '2024-10-07 00:00:00', NULL, 67, ''),
(203, '5916 Caravan Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-09-29 00:00:00', '2023-09-29 00:00:00', NULL, 68, ''),
(204, '13351 State Road 535', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-16 00:00:00', '2025-06-16 00:00:00', NULL, 69, ''),
(205, '7800 Universal Boulevard', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-17 00:00:00', '2025-06-17 00:00:00', NULL, 70, ''),
(206, '7800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-30 16:57:23', '2025-06-30 16:57:23', NULL, 71, ''),
(207, '7800 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-01 09:00:00', '2025-07-01 09:00:00', NULL, 72, ''),
(208, '601 Front Street', '', 'Key West', '33040', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-01-15 00:00:00', NULL, 73, ''),
(209, '5472 Gateway Village Circle', '', 'Orlando', '32812', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-20 00:00:00', '2025-02-20 00:00:00', NULL, 74, ''),
(210, '5940 Caravan Ct', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-10 00:00:00', '2025-03-10 00:00:00', NULL, 75, ''),
(211, '5976 Caravan Court', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-04-05 00:00:00', '2025-04-05 00:00:00', NULL, 76, ''),
(212, '8741 International Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-06-06 00:00:00', '2023-06-06 00:00:00', NULL, 77, ''),
(213, '50 Alhambra Plaza', '', 'Coral Gables', '33134', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-06-06 00:00:00', '2023-06-06 00:00:00', NULL, 78, ''),
(214, 'ONE GRAND CYPRESS BLVD', '', 'ORLANDO', '32836', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, 79, ''),
(215, '9801 INTERNATIONAL DRIVE', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-10-11 00:00:00', '2023-10-11 00:00:00', NULL, 80, ''),
(216, '3033 Newcastle Loop', '', 'Myrtle Beach', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-07 00:00:00', '2025-02-07 00:00:00', NULL, 81, ''),
(217, '117 N Elm STreet', '', 'COLUMBIA', '27925', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2022-06-12 00:00:00', '2022-06-12 00:00:00', NULL, 82, ''),
(218, '25 N Main Street', 'Suite G', 'Moncks Corner', '29461', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2022-02-21 00:00:00', '2022-02-21 00:00:00', NULL, 83, ''),
(219, '227 Stallsville Loop', 'Ste A', 'Summerville', '29485', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-27 00:00:00', '2025-02-27 00:00:00', NULL, 84, ''),
(220, '227 Stallsville Loop', 'Suite A', 'Summerville', '29485', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2023-03-21 00:00:00', '2023-03-21 00:00:00', NULL, 85, ''),
(221, '2134 Center Way', '', 'Middleburg', '32068', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-06-02 00:00:00', '2025-06-02 00:00:00', NULL, 86, ''),
(222, '985 Charles Lindbergh Dr', '', 'jacksonville', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-05-29 00:00:00', '2025-05-29 00:00:00', NULL, 87, ''),
(223, '11107 ATLANTIC BLVD', '', 'JACKSONVILLE', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-03-10 00:00:00', '2025-03-10 00:00:00', NULL, 88, ''),
(224, '9301 Lake Nona Blvd', '', 'Orlando', '32827', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-10 00:00:00', '2025-01-10 00:00:00', NULL, 89, ''),
(225, '7220 Financial Way, Jacksonville, FL 32256', '', 'Jacksonville', '32256', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-11 00:00:00', '2025-01-11 00:00:00', NULL, 90, ''),
(226, '17777 Bali Blvd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-12 00:00:00', '2025-01-12 00:00:00', NULL, 91, ''),
(227, '6800 Lakewood Plaza Drive', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-13 00:00:00', '2025-01-13 00:00:00', NULL, 92, ''),
(228, '3101 Shelby Industrial Drive', '', 'Apopka', '32703', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-14 00:00:00', '2025-01-14 00:00:00', NULL, 93, ''),
(229, '6300 Hollywood Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-15 00:00:00', '2025-01-15 00:00:00', NULL, 94, ''),
(230, '6300 Hollywood Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-16 00:00:00', '2025-01-16 00:00:00', NULL, 95, ''),
(231, '6601 Adventure Way', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-17 00:00:00', '2025-01-17 00:00:00', NULL, 96, ''),
(232, '721 Ballough Rd.', '', 'Daytona', '32114', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-18 00:00:00', '2025-01-18 00:00:00', NULL, 97, ''),
(233, '901 Maxwell St', '', 'Lake Geneva', '53147', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-01-19 00:00:00', '2025-01-19 00:00:00', NULL, 98, ''),
(234, '4810 West Irlo Bronson Memorial Hwy', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-20 00:00:00', '2025-01-20 00:01:00', NULL, 99, ''),
(235, '1200 Riverplace Blvd', 'Ste 800', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-21 00:00:00', '2025-01-21 00:00:00', NULL, 100, ''),
(236, '11251 Harbour Villa Rd', 'Engineering', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-22 00:00:00', '2025-01-22 00:00:00', NULL, 101, ''),
(237, '7102 Grand Horizons Blvd', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-23 00:00:00', '2025-01-23 00:00:00', NULL, 102, ''),
(238, '9301 Lake Nona Blvd', '', 'Orlando', '32827', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-24 00:00:00', '2025-01-24 00:00:00', NULL, 103, ''),
(239, '555 Hazeltine National Dr', '', 'Orlando', '32812', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-25 00:00:00', '2025-01-25 00:00:00', NULL, 104, ''),
(240, '1816 E Colonial Dr', '', 'Orlando', '32803', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-26 00:00:00', '2025-01-26 00:00:00', NULL, 105, ''),
(241, '8926 International Dr', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-27 00:00:00', '2025-01-27 00:00:00', NULL, 106, ''),
(242, '10100 International Drive', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-28 00:00:00', '2025-01-28 00:00:00', NULL, 107, ''),
(243, '4600 South Ocean Blvd', '', 'Highland Beach', '33455', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-29 00:00:00', '2025-01-29 00:00:00', NULL, 108, ''),
(244, '1606 Erie Ave', '', 'Sheboygan', '53081', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-01-30 00:00:00', '2025-01-30 00:00:00', NULL, 109, ''),
(245, '1501 International Pkwy', '', 'Kissimmee', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-01-31 00:00:00', '2025-01-31 00:00:00', NULL, 110, ''),
(246, '3090 Michigan Ave.', '', 'Kissimmee', '34744', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-01 00:00:00', '2025-02-01 00:00:00', NULL, 111, ''),
(247, '2400 NE 12th St', '', 'Pompano Beach', '33062', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-02 00:00:00', '2025-02-02 00:00:00', NULL, 112, ''),
(248, '1730 University Blvd', '', 'Albuquerque', '87106', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2025-02-03 00:00:00', '2025-02-03 00:00:00', NULL, 113, ''),
(249, '1 Clubhouse Dr', '', 'Sandia Park', '87047', 'United States', 'New Mexico', NULL, NULL, 1, 0, '2025-02-04 00:00:00', '2025-02-04 00:00:00', NULL, 114, ''),
(250, '1500 N Thacker Ave', '', 'Kissimmee', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-05 00:00:00', '2025-02-05 00:00:00', NULL, 115, ''),
(251, '3505 N Hwy 1792', '', 'Longwood', '32750', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-06 00:00:00', '2025-02-06 00:00:00', NULL, 116, ''),
(252, '102 Maple Forest Ct.', '', 'Hendersonville', '37075', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2025-02-07 00:00:00', '2025-02-07 00:00:00', NULL, 117, ''),
(253, '215 Looney Rd', '', 'Piqua', '45356', 'United States', 'Ohio', NULL, NULL, 1, 0, '2025-02-08 00:00:00', '2025-02-08 00:00:00', NULL, 118, ''),
(254, '36900 Harper', '', 'Clinton Township', '48035', 'United States', 'Michigan', NULL, NULL, 1, 0, '2025-02-09 00:00:00', '2025-02-09 00:00:00', NULL, 119, ''),
(255, '5905 Kirkman Road', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-10 00:00:00', '2025-02-10 00:00:00', NULL, 120, ''),
(256, '19910 W 161st Street', '', 'Olathe', '66062', 'United States', 'Kansas', NULL, NULL, 1, 0, '2025-02-11 00:00:00', '2025-02-11 00:00:00', NULL, 121, ''),
(257, '5601 Universal Blvd', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-12 00:00:00', '2025-02-12 00:00:00', NULL, 122, ''),
(279, '4110 Southpoint Boulevard', 'Suite 100', 'Jacksonville', '32216', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, 123, ''),
(280, '3316 Platt Springs Rd', '', 'West Columbia', '29170', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, 124, ''),
(281, '13279 Hartzog Rd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, 125, ''),
(282, '11107 Atlantic Blvd', '', 'Jacksonville', '32225', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, 126, ''),
(283, '2717 Fowler Ave', '', 'Memphis', '38112', 'United States', 'Tennessee', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, 127, ''),
(284, '8451 International Dr', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-18 00:00:00', '2025-02-18 00:00:00', NULL, 128, ''),
(285, '3333 N Atlantic Ave', '', 'Daytona Beach', '33404', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-19 00:00:00', '2025-02-19 00:00:00', NULL, 129, ''),
(286, '12724 Gran Bay Parkway West Suite 200', '', 'Jacksonville', '32258', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, 130, ''),
(287, '12724 Gran Bay Pkwy W', 'Ste 200', 'Jacksonville', '32258', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-13 00:00:00', '2025-02-13 00:00:00', NULL, 131, ''),
(288, '137 Concord Drive', 'Suite 1101', 'Casselberry', '32707', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, 132, ''),
(289, '5561 Alpine Drive', '', 'Summerville', '29483', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-02-14 00:00:00', '2025-02-14 00:00:00', NULL, 133, ''),
(290, '3563 Philips Highway', 'Suite F-601', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, 134, ''),
(291, '1000 Riverside Ave Unit #100', '', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-15 00:00:00', '2025-02-15 00:00:00', NULL, 135, ''),
(292, '1000 Riverside Ave', '', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, 136, ''),
(293, '1000 Riverside Ave', 'Suite 100', 'Jacksonville', '32204', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-16 00:00:00', '2025-02-16 00:00:00', NULL, 137, ''),
(294, '7703 Kingspointe Pkwy', '#300', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, 138, ''),
(295, '16192 Aspen Ln', '', 'Biloxi', '39532', 'United States', 'Mississippi', NULL, NULL, 1, 0, '2025-02-17 00:00:00', '2025-02-17 00:00:00', NULL, 139, ''),
(296, '1200 Rinehart Rd', '', 'Sanford', '32771', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, 140, ''),
(297, '1989 Front St', '', 'Cuyahoga Falls', '44221', 'United States', 'Ohio', NULL, NULL, 1, 0, '2023-06-18 00:00:00', '2023-06-18 00:00:00', NULL, 141, ''),
(298, 'Augusta National Dr', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-08-29 00:00:00', '2022-08-29 00:00:00', NULL, 142, ''),
(299, '8800 Vistana Centre Drive', '', 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-22 00:00:00', '2022-03-22 00:00:00', NULL, 143, ''),
(300, '501 Vineland Road', '', 'Orlando', '32811', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-03 00:00:00', '2022-03-03 00:00:00', NULL, 144, ''),
(301, '410 Caring Drive', '', 'Lake Mary', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-02-13 00:00:00', '2023-02-13 00:00:00', NULL, 145, ''),
(302, '240 Battleground Road', '', 'Kings Mountain', '28086', 'United States', 'North Carolina', NULL, NULL, 1, 0, '2023-03-06 00:00:00', '2023-03-06 00:00:00', NULL, 146, ''),
(303, '4110 Southpoint Boulevard', 'Suite 100', 'Jacksonville', '32216', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-11-03 00:00:00', '2023-11-03 00:00:00', NULL, 147, ''),
(304, '3316 Platt Springs Rd', '', 'West Columbia', '29170', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2022-06-02 00:00:00', '2022-06-02 00:00:00', NULL, 148, ''),
(305, '13279 Hartzog Rd', '', 'Winter Garden', '34787', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-03-04 00:00:00', '2024-03-04 00:00:00', NULL, 149, ''),
(306, '5876 West Irlo Bronson Memorial Highway', '', 'Kissimmee', '34743', 'United States', 'Florida', NULL, NULL, 1, 0, '2023-05-30 00:00:00', '2023-05-30 00:00:00', NULL, 150, ''),
(307, '404 Village Drive', '', 'Kissimmee', '34759', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-02-15 00:00:00', '2022-02-15 00:00:00', NULL, 151, ''),
(308, '301 W Bay St', 'Suite 2600', 'Jacksonville', '32202', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-12-08 00:00:00', '2022-12-08 00:00:00', NULL, 152, ''),
(309, '333 South Delaware Street', '', 'Indianapolis', '46204', 'United States', 'Indiana', NULL, NULL, 1, 0, '2022-11-18 00:00:00', '2022-11-18 00:00:00', NULL, 153, ''),
(310, '1301 Riverplace Blvd, ', 'Suite 2700', 'Jacksonville', '32207', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-19 00:00:00', '2022-01-19 00:00:00', NULL, 154, ''),
(311, '1875 N SANDUSKY AVE', '', 'BUCYRUS', '44820-1337', 'United States', 'Ohio', NULL, NULL, 1, 0, '2022-05-23 00:00:00', '2022-05-23 00:00:00', NULL, 155, ''),
(312, '600 N Atlantic Ave', '', 'Daytona Beach', '32118', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-19 00:00:00', '2022-01-19 00:00:00', NULL, 156, ''),
(313, '7389 Universal BLVD', '', 'ORLANDO', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-09-23 00:00:00', '2024-09-23 00:00:00', NULL, 157, ''),
(314, '316 Live Oaks Blvd', '', 'Cassellberry', '32707', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-03-15 00:00:00', '2022-03-15 00:00:00', NULL, 158, ''),
(315, '6211 Ocean Ave', '', 'Wildwood Crest', '8260', 'United States', 'New Jersey', NULL, NULL, 1, 0, '2024-06-21 00:00:00', '2024-06-21 00:00:00', NULL, 159, ''),
(316, '123 Auto Auto least and sales', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-01 00:00:00', '2024-01-01 00:00:00', NULL, 160, ''),
(317, '200 Tom Batchelor', '', 'Orlando', '32822', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-02 00:00:00', '2024-01-02 00:00:00', NULL, 161, ''),
(318, '314 Town Center', '', 'Casselberry', '32714', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-03 00:00:00', '2024-01-03 00:00:00', NULL, 162, ''),
(319, '100 Susan St', '', 'Winter Park', '33000', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-04 00:00:00', '2024-01-04 00:00:00', NULL, 163, ''),
(320, '500 Machado Blvd', '', 'Los Angeles', '12345', 'United States', 'California', NULL, NULL, 1, 0, '2024-01-05 00:00:00', '2024-01-05 00:00:00', NULL, 164, ''),
(321, '789 Waters Rd', '', 'Phoenix', '85001', 'United States', 'Arizona', NULL, NULL, 1, 0, '2024-01-06 00:00:00', '2024-01-06 00:00:00', NULL, 165, ''),
(322, '132 Truvillion St', '', 'New York', '10001', 'United States', 'New York', NULL, NULL, 1, 0, '2024-01-07 00:00:00', '2024-01-07 00:00:00', NULL, 166, ''),
(323, '321 Maxon Ave', '', 'Hartford', '53000', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2024-01-08 00:00:00', '2024-01-08 00:00:00', NULL, 167, ''),
(324, '219 Ward Dr', '', 'Lyndhurst', '07086', 'United States', 'New Jersey', NULL, NULL, 1, 0, '2024-01-09 00:00:00', '2024-01-09 00:00:00', NULL, 168, ''),
(325, '47 Ferrara Lane', '', 'New York', '10002', 'United States', 'New York', NULL, NULL, 1, 0, '2024-01-10 00:00:00', '2024-01-10 00:00:00', NULL, 169, ''),
(326, '88 Mortuary Blvd', '', 'Dania Beach', '33051', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-11 00:00:00', '2024-01-11 00:00:00', NULL, 170, ''),
(327, '123 Patricia St', '', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-12 00:00:00', '2024-01-12 00:00:00', NULL, 171, ''),
(328, '45 Eberle Ct', '', 'Orlando', '32825', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-13 00:00:00', '2024-01-13 00:00:00', NULL, 172, ''),
(329, '159 Lopez Rd', '', 'Apopka', '32703', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-14 00:00:00', '2024-01-14 00:00:00', NULL, 173, ''),
(330, '111 Davis Ave', '', 'Jacksonville', '32255', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-15 00:00:00', '2024-01-15 00:00:00', NULL, 174, ''),
(331, '200 Jamison Blvd', '', 'Orlando', '32826', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-16 00:00:00', '2024-01-16 00:00:00', NULL, 175, ''),
(332, '302 Sanchez St', '', 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-17 00:00:00', '2024-01-17 00:00:00', NULL, 176, ''),
(333, '404 Fleming Rd', '', 'Miami', '33063', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-18 00:00:00', '2024-01-18 00:00:00', NULL, 177, ''),
(334, '516 Layug Blvd', '', 'Hialeah', '33013', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-19 00:00:00', '2024-01-19 00:00:00', NULL, 178, ''),
(335, '617 Mussolino Drive', '', 'Kissimmee', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-01-20 00:00:00', '2024-01-20 00:00:00', NULL, 179, ''),
(336, '3011 Maingate Lane', '', 'Kissimmee', '34747', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-01 00:00:00', '2024-02-01 00:00:00', NULL, 180, ''),
(337, '5324 Fairfield Lake Dr.', '', 'Kissimmee', '34746', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-02 00:00:00', '2024-02-02 00:00:00', NULL, 181, ''),
(338, '1850 Hotel Plaza Blvd', '', 'Lake Buena Vista', '32830', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-03 00:00:00', '2024-02-03 00:00:00', NULL, 182, ''),
(339, '200 S Orange Ave', 'Suite 2700', 'Orlando', '32801', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-04 00:00:00', '2024-02-04 00:00:00', NULL, 183, ''),
(340, '11109 North 30th Street', '', 'Tampa', '33612', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-05 00:00:00', '2024-02-05 00:00:00', NULL, 184, ''),
(341, '7400 International Drive', '', NULL, '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2022-01-26 00:00:00', '2022-01-26 00:00:00', NULL, 186, ''),
(342, 'company one', NULL, 'Lahore1', '51000', 'United States', 'Wisconsin', NULL, NULL, 1, 0, '2025-07-03 14:52:06', '2025-07-03 14:52:06', NULL, 191, ''),
(343, '11109 North 30th Street', '', 'Tampa', '33612', 'United States', 'Florida', NULL, NULL, 1, 0, '2024-02-05 00:00:00', '2024-02-05 00:00:00', NULL, 185, ''),
(344, '1141 Cainhoy Rd', NULL, 'Charleston', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-03 16:22:55', '2025-07-03 16:22:55', NULL, 195, ''),
(345, 'Allfor care Services Ltd.', NULL, 'southall ', 'HA3 9NS', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-04 08:23:29', '2025-07-04 08:23:29', NULL, 196, ''),
(346, 'rtrtyt', NULL, 'ertryttryt', 'eertry', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-04 13:51:24', '2025-07-04 13:51:24', NULL, 197, ''),
(347, 'company demo address', NULL, 'miami 34', '1234', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-07 09:34:24', '2025-07-21 12:12:57', NULL, 198, ''),
(348, '	Innovative Endodontics MB', NULL, 'Myrtle Beach', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-07 17:20:50', '2025-07-07 17:20:50', NULL, 199, ''),
(349, 'Orlando Marriott Lake Mary', NULL, 'Lake Mary', '32746', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-14 11:15:23', '2025-07-14 11:15:23', NULL, 200, ''),
(350, 'Marriott\'s Harbour Lake', NULL, 'Orlando', '32821', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 06:13:06', '2025-07-16 06:13:06', NULL, 201, ''),
(351, 'Park Royal', NULL, 'Kissimmee', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 06:54:38', '2025-07-16 06:54:38', NULL, 202, ''),
(352, 'Portofino Bay', NULL, 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 10:12:40', '2025-07-16 10:12:40', NULL, 203, ''),
(353, 'Hilton Melbourne Beach', NULL, 'Indialantic', '32903', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 11:09:47', '2025-07-16 11:09:47', NULL, 204, ''),
(354, 'Loews Royal Pacific Resort', NULL, 'Orlando', '32819', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-16 15:19:07', '2025-07-16 15:19:07', NULL, 205, ''),
(355, 'Azhar 99 shipping', NULL, 'Lahore', '51000', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 08:04:17', '2025-07-17 08:04:17', NULL, 206, ''),
(356, 'bbb', NULL, 'Lahore', '51000', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 11:12:25', '2025-07-17 11:12:25', NULL, 207, ''),
(357, 'bbb', NULL, 'Lahore', '555', 'United States', 'Wyoming', NULL, NULL, 1, 0, '2025-07-17 11:15:57', '2025-07-17 11:15:57', NULL, 209, ''),
(358, '1141 Cainhoy Rd', NULL, 'Charleston', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-17 15:12:51', '2025-07-17 15:12:51', NULL, 212, ''),
(359, 'PARK ROYAL', NULL, 'KISSIMMEE', '34741', 'United States', 'Florida', NULL, NULL, 1, 0, '2025-07-18 01:44:57', '2025-07-18 01:44:57', NULL, 213, ''),
(360, 'Pool Service Pros', NULL, 'Charleston', '29492', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-18 17:37:28', '2025-07-18 17:37:28', NULL, 220, ''),
(361, 'Innovative Endodontics MB', NULL, 'MYRTLE BEACH', '29588', 'United States', 'South Carolina', NULL, NULL, 1, 0, '2025-07-21 17:36:26', '2025-07-21 17:36:26', NULL, 225, '');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `status` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `deleted`, `status`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
(1, 'Coffee Beans- ground', 0, 1, '2025-07-01 13:10:03', '2025-07-01 13:10:03', NULL),
(2, 'Condiments', 0, 1, '2025-07-01 14:46:48', '2025-07-01 14:46:48', NULL),
(3, 'Espresso Machines', 0, 1, '2025-07-01 14:46:48', '2025-07-01 14:46:48', NULL),
(4, 'Soluble', 0, 1, '2025-07-01 14:46:48', '2025-07-01 14:46:48', NULL),
(5, 'Single Serve Beverage Pod- Box of 12', 0, 1, '2025-07-01 14:46:48', '2025-07-01 14:46:48', NULL),
(6, 'Coffee Beans - Whole Bean', 0, 1, '2025-07-01 13:10:03', '2025-07-01 13:10:03', NULL),
(7, 'demo cat', 1, 1, '2025-07-07 11:17:23', '2025-07-07 11:17:57', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `chequeDetails`
--

CREATE TABLE `chequeDetails` (
  `id` int(11) NOT NULL,
  `chequeNumber` varchar(255) NOT NULL,
  `chequeDate` date NOT NULL,
  `chequeStatus` varchar(255) DEFAULT NULL,
  `bankName` varchar(255) DEFAULT NULL,
  `bankBranch` varchar(255) DEFAULT NULL,
  `chequeType` varchar(255) DEFAULT NULL,
  `chequeReceiptDate` date NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `orderId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `chequeDetails`
--

INSERT INTO `chequeDetails` (`id`, `chequeNumber`, `chequeDate`, `chequeStatus`, `bankName`, `bankBranch`, `chequeType`, `chequeReceiptDate`, `createdAt`, `updatedAt`, `deletedAt`, `orderId`) VALUES
(1, '12345', '2025-07-07', 'Cleared', 'BANK OF WHO', 'no', 'business check', '2025-07-07', '2025-07-07 17:51:19', '2025-07-07 17:51:19', NULL, 33),
(2, 'demo check', '2025-07-08', 'Cleared', 'faysal islamic bank', 'thokar niaz baig', 'personal check', '2025-07-08', '2025-07-08 04:39:47', '2025-07-08 04:39:47', NULL, 35);

-- --------------------------------------------------------

--
-- Table structure for table `cityInSystems`
--

CREATE TABLE `cityInSystems` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `countryInSystemId` int(11) DEFAULT NULL,
  `stateInSystemId` int(11) DEFAULT NULL,
  `territoryId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cityInSystems`
--

INSERT INTO `cityInSystems` (`id`, `name`, `deleted`, `createdAt`, `updatedAt`, `countryInSystemId`, `stateInSystemId`, `territoryId`) VALUES
(847, 'Alachua', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(848, 'Altamonte Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(849, 'Anna Maria', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(850, 'Apalachicola', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(851, 'Apopka', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(852, 'Arcadia', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(853, 'Archer', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(854, 'Belleair Bluffs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(855, 'Belleview', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(856, 'Blountstown', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(857, 'Boca Raton', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(858, 'Bonifay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(859, 'Bonita Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(860, 'Bradenton', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(861, 'Bradenton Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(862, 'Briny Breezes', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(863, 'Bristol', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(864, 'Brooksville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(865, 'Bunnell', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(866, 'Bushnell', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(867, 'Callaway', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(868, 'Cape Canaveral', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(869, 'Cape Coral', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(870, 'Carrabelle', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(871, 'Casselberry', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(872, 'Cedar Key', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(873, 'Center Hill', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(874, 'Clearwater', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(875, 'Clermont', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(876, 'Clewiston', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(877, 'Cocoa', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(878, 'Cocoa Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(879, 'Coconut Creek', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(880, 'Cooper City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(881, 'Coral Gables', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(882, 'Coral Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(883, 'Crescent City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(884, 'Crestview', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(885, 'Crystal River', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(886, 'Cutler Bay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(887, 'Dade City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(888, 'Dania Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(889, 'Davenport', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(890, 'Davie', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(891, 'Daytona Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(892, 'Daytona Beach Shores', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(893, 'DeBary', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(894, 'Deerfield Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(895, 'DeFuniak Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(896, 'DeLand', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(897, 'Delray Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(898, 'Deltona', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(899, 'Destin', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(900, 'Doral', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(901, 'Dunedin', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(902, 'Eagle Lake', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(903, 'Edgewater', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(904, 'Edgewood', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(905, 'El Portal', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(906, 'Estero', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(907, 'Eustis', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(908, 'Everglades City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(909, 'Fellsmere', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(910, 'Fernandina Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(911, 'Flagler Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(912, 'Florida City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(913, 'Fort Lauderdale', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(914, 'Fort Myers', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(915, 'Fort Myers Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(916, 'Fort Pierce', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(917, 'Fort Walton Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(918, 'Freeport', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(919, 'Frostproof', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(920, 'Fruitland Park', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(921, 'Gainesville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(922, 'Golden Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(923, 'Graceville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(924, 'Green Cove Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(925, 'Greenacres', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(926, 'Gulf Breeze', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(927, 'Gulfport', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(928, 'Haines City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(929, 'Hallandale Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(930, 'Havana', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(931, 'Hialeah', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(932, 'Hialeah Gardens', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(933, 'High Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(934, 'Hilliard', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(935, 'Hollywood', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(936, 'Holmes Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(937, 'Homestead', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(938, 'Howey‑in‑the‑Hills', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(939, 'Hypoluxo', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(940, 'Indian Harbour Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(941, 'Indian Rocks Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(942, 'Indiantown', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(943, 'Inglis', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(944, 'Interlachen', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(945, 'Inverness', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(946, 'Islamorada', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(947, 'Jacksonville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(948, 'Jacksonville Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(949, 'Jacob City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(950, 'Jasper', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(951, 'Jay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(952, 'Jennings', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(953, 'Juno Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(954, 'Lake Alfred', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(955, 'Lake Wales', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(956, 'Lake Worth', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(957, 'Lakeland', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(958, 'Lynn Haven', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(959, 'Macclenny', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(960, 'Madeira Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(961, 'Madison', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(962, 'Maitland', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(963, 'Malabar', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(964, 'Marathon', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(965, 'Marco Island', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(966, 'Margate', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(967, 'Marianna', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(968, 'Melbourne', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(969, 'Melbourne Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(970, 'Mexico Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(971, 'Miami', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(972, 'Miami Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(973, 'Miami Gardens', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(974, 'Miami Lakes', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(975, 'Miami Shores', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(976, 'Miami Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(977, 'Micanopy', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(978, 'Milton', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(979, 'Minneola', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(980, 'Miramar', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(981, 'Monticello', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(982, 'Montverde', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(983, 'Moore Haven', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(984, 'Mount Dora', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(985, 'Mulberry', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(986, 'Naples', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(987, 'Neptune Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(988, 'New Port Richey', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(989, 'New Smyrna Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(990, 'Newberry', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(991, 'Niceville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(992, 'North Bay Village', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(993, 'North Lauderdale', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(994, 'North Miami', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(995, 'North Miami Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(996, 'North Palm Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(997, 'North Port', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(998, 'Oak Hill', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(999, 'Oakland', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1000, 'Oakland Park', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1001, 'Ocala', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1002, 'Ocean Ridge', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1003, 'Ocoee', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1004, 'Okeechobee', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1005, 'Oldsmar', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1006, 'Opa‑locka', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1007, 'Orange City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1008, 'Orange Park', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1009, 'Orlando', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1010, 'Ormond Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1011, 'Oviedo', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1012, 'Palm Bay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1013, 'Palm Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1014, 'Palm Beach Gardens', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1015, 'Palm Bay (duplicate?)', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1016, 'Palm Beach Shores', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1017, 'Palm Coast', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1018, 'Palm Shores', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1019, 'Palm Springs', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1020, 'Palmetto', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1021, 'Palmetto Bay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1022, 'Panama City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1023, 'Panama City Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1024, 'Parker', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1025, 'Parkland', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1026, 'Pahokee', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1027, 'Pensacola', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1028, 'Perry', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1029, 'Pierson', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1030, 'Pinellas Park', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1031, 'Plant City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1032, 'Plantation', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1033, 'Polk City', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1034, 'Pompano Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1035, 'Ponce de Leon', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1036, 'Ponce Inlet', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1037, 'Port Orange', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1038, 'Port Richey', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1039, 'Port St. Joe', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1040, 'Port St. Lucie', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1041, 'Punta Gorda', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1042, 'Quincy', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1043, 'Raiford', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1044, 'Reddick', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1045, 'Redington Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1046, 'Redington Shores', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1047, 'Riviera Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1048, 'Rockledge', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1049, 'Royal Palm Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1050, 'Safety Harbor', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1051, 'San Antonio', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1052, 'Sanford', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1053, 'Sanibel', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1054, 'Sarasota', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1055, 'Satellite Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1056, 'Sebastian', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1057, 'Sebring', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1058, 'Seminole', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1059, 'Sewall\'s Point', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1060, 'Shalimar', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1061, 'Sneads', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1062, 'Sopchoppy', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1063, 'South Bay', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1064, 'South Daytona', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1065, 'South Miami', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1066, 'South Pasadena', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1067, 'Southwest Ranches', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1068, 'Springfield', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1069, 'St. Augustine', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1070, 'St. Augustine Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1071, 'St. Petersburg', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1072, 'St. Pete Beach', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1073, 'Tallahassee', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1074, 'Titusville', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1075, 'Tequesta', 0, '2025-07-01 11:18:04', '2025-07-01 11:18:04', 1, 9, NULL),
(1076, 'Fort Worth', 0, '2025-07-08 05:48:17', '2025-07-08 05:48:17', 1, 43, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `countryInSystems`
--

CREATE TABLE `countryInSystems` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `isoCode` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `countryInSystems`
--

INSERT INTO `countryInSystems` (`id`, `name`, `isoCode`, `deleted`, `createdAt`, `updatedAt`) VALUES
(1, 'United States', 'US', 0, '2025-06-30 14:16:08', '2025-06-30 14:16:08'),
(2, 'Canada', 'CA', 1, '2025-07-07 07:18:44', '2025-07-07 07:18:48');

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `id` int(11) NOT NULL,
  `qty` varchar(255) NOT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `weight` decimal(10,2) DEFAULT 0.00,
  `unit` varchar(255) DEFAULT '',
  `salerCommission` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `wholesalePrice` decimal(10,2) DEFAULT 0.00,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `categoryId` int(11) DEFAULT NULL,
  `orderId` int(11) DEFAULT NULL,
  `orderFrequencyId` int(11) DEFAULT NULL,
  `productId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `items`
--

INSERT INTO `items` (`id`, `qty`, `price`, `weight`, `unit`, `salerCommission`, `discount`, `wholesalePrice`, `deleted`, `createdAt`, `updatedAt`, `deletedAt`, `categoryId`, `orderId`, `orderFrequencyId`, `productId`) VALUES
(2, '1', 1.00, 1.00, 'kg', 0.50, 0.00, 0.50, 0, '2025-07-02 09:46:20', '2025-07-02 09:46:20', NULL, 6, 2, NULL, 60),
(3, '1', 110.00, 12.00, 'pounds', 60.50, 0.00, 49.50, 0, '2025-07-01 15:24:54', '2025-07-02 09:48:53', NULL, 4, 3, NULL, 52),
(4, '3', 330.00, 36.00, 'pounds', 181.50, 0.00, 148.50, 0, '2025-07-01 15:24:54', '2025-07-03 15:11:11', NULL, 4, 4, 4, 52),
(5, '3', 300.00, 36.00, 'pounds', 165.00, 0.00, 135.00, 0, '2025-07-01 15:24:54', '2025-07-03 15:11:11', NULL, 4, 4, 4, 51),
(6, '3', 597.00, 36.00, '', 177.00, 0.00, 420.00, 0, '2025-07-03 15:47:31', '2025-07-03 15:47:31', NULL, NULL, 5, NULL, 13),
(7, '2', 2.00, 2.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-02 09:46:20', NULL, 6, 6, NULL, 60),
(8, '9', 9.00, 9.00, 'kg', 4.50, 0.00, 4.50, 0, '2025-07-02 09:46:20', '2025-07-02 09:46:20', NULL, 6, 7, NULL, 60),
(9, '2', 2.00, 2.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-02 09:46:20', NULL, 6, 8, NULL, 60),
(10, '3', 29.22, 36.00, '', 16.08, 0.00, 13.14, 0, '2025-07-04 06:30:35', '2025-07-04 06:30:35', NULL, NULL, 9, NULL, 40),
(11, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 10, NULL, 60),
(12, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-04 10:10:42', '2025-07-04 10:10:42', NULL, NULL, 11, NULL, 60),
(13, '3', 29.22, 36.00, '', 0.00, 0.00, 0.00, 0, '2025-07-04 13:54:05', '2025-07-04 13:54:05', NULL, NULL, 12, NULL, 44),
(14, '2', 2.00, 8000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-04 15:06:45', '2025-07-04 15:06:45', NULL, NULL, 13, NULL, 60),
(15, '2', 2.00, 2.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-02 09:46:20', NULL, 6, 14, NULL, 60),
(16, '2', 2.00, 8000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-04 15:22:59', '2025-07-04 15:22:59', NULL, NULL, 15, NULL, 60),
(17, '2', 200.00, 24.00, 'pounds', 110.00, 0.00, 90.00, 0, '2025-07-01 15:24:54', '2025-07-02 11:01:47', NULL, 4, 16, NULL, 51),
(18, '2', 19.48, 24.00, 'pounds', 10.72, 0.00, 8.76, 0, '2025-07-01 15:23:44', '2025-07-02 10:04:41', NULL, 5, 16, NULL, 43),
(19, '3', 597.00, 36.00, '', 177.00, 0.00, 420.00, 0, '2025-07-07 06:16:59', '2025-07-07 06:16:59', NULL, NULL, 17, NULL, 13),
(20, '1', 86.00, 12.00, '', 21.50, 0.00, 64.50, 0, '2025-07-07 06:16:59', '2025-07-07 06:16:59', NULL, NULL, 17, NULL, 17),
(21, '1', 39.00, 12.00, '', 16.00, 0.00, 23.00, 0, '2025-07-07 06:26:22', '2025-07-07 06:26:22', NULL, NULL, 18, NULL, 55),
(22, '2', 2.00, 8000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-07 06:28:54', '2025-07-07 06:28:54', NULL, NULL, 19, NULL, 60),
(23, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-07 06:44:12', '2025-07-07 06:44:12', NULL, NULL, 20, NULL, 21),
(24, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-07 07:22:45', '2025-07-07 07:22:45', NULL, NULL, 21, NULL, 43),
(25, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-07 07:46:47', '2025-07-07 07:46:47', NULL, NULL, 22, NULL, 43),
(26, '1', 39.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-07 09:40:48', '2025-07-07 09:40:48', NULL, NULL, 23, NULL, 55),
(27, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 24, NULL, 60),
(28, '1', 5500.00, 12.00, '', 1700.00, 0.00, 3800.00, 0, '2025-07-07 13:39:19', '2025-07-07 13:39:19', NULL, NULL, 25, NULL, 59),
(29, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:58:30', '2025-07-10 14:48:47', 4, 26, NULL, 49),
(30, '1', 110.00, 12.00, 'pounds', 60.50, 0.00, 49.50, 0, '2025-07-01 15:24:54', '2025-07-02 09:57:47', '2025-07-10 14:48:47', 4, 26, NULL, 50),
(31, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:58:30', NULL, 4, 27, NULL, 49),
(32, '1', 110.00, 12.00, 'pounds', 60.50, 0.00, 49.50, 0, '2025-07-01 15:24:54', '2025-07-02 09:57:47', NULL, 4, 27, NULL, 50),
(33, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-07 13:46:36', '2025-07-07 13:46:36', NULL, NULL, 28, NULL, 60),
(34, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 29, NULL, 60),
(35, '2', 2.00, 8000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-07 14:42:37', '2025-07-07 14:42:37', NULL, NULL, 30, NULL, 60),
(36, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 31, NULL, 60),
(37, '1', 135.90, 12.00, 'pounds', 30.90, 0.00, 105.00, 0, '2025-07-01 15:18:35', '2025-07-02 09:28:52', NULL, 6, 32, NULL, 10),
(38, '1', 99.00, 12.00, 'pounds', 54.45, 0.00, 44.55, 0, '2025-07-01 15:24:54', '2025-07-02 10:01:40', NULL, 4, 33, NULL, 46),
(39, '1', 39.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-08 04:31:28', '2025-07-08 04:31:28', NULL, NULL, 34, NULL, 55),
(40, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-08 04:33:50', '2025-07-08 04:33:50', NULL, NULL, 35, NULL, 42),
(41, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-08 06:22:19', '2025-07-08 06:22:19', NULL, NULL, 36, NULL, 43),
(42, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-08 12:33:50', '2025-07-08 12:33:50', NULL, NULL, 37, NULL, 40),
(43, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:48:53', NULL, 4, 38, NULL, 52),
(44, '1', 1.00, 2.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 05:57:19', '2025-07-09 05:57:19', NULL, NULL, 39, NULL, 62),
(45, '1', 1.00, 2.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 07:43:10', '2025-07-09 07:43:10', NULL, NULL, 40, NULL, 62),
(46, '2', 2.00, 4.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 10:06:24', '2025-07-09 10:06:24', NULL, NULL, 41, NULL, 62),
(47, '2', 19.48, 24.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 10:08:19', '2025-07-09 10:08:19', NULL, NULL, 42, NULL, 43),
(48, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 10:09:54', '2025-07-09 10:09:54', NULL, NULL, 43, NULL, 43),
(49, '1', 1.00, 2.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 10:09:54', '2025-07-09 10:09:54', NULL, NULL, 43, NULL, 62),
(50, '2', 2.00, 8000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-09 14:13:46', '2025-07-09 14:13:46', NULL, NULL, 44, NULL, 60),
(51, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-09 14:23:16', '2025-07-09 14:23:16', NULL, NULL, 45, NULL, 60),
(64, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', '2025-07-10 14:38:30', 6, 46, NULL, 60),
(65, '5', 5.00, 20000.00, '', 2.50, 0.00, 2.50, 0, '2025-07-10 14:38:30', '2025-07-10 14:38:30', '2025-07-10 14:52:10', NULL, 46, NULL, 60),
(66, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-10 14:48:47', '2025-07-10 14:48:47', '2025-07-10 14:50:55', NULL, 26, NULL, 49),
(67, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-10 14:48:47', '2025-07-10 14:48:47', '2025-07-10 14:50:55', NULL, 26, NULL, 50),
(68, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-10 14:50:55', '2025-07-10 14:50:55', NULL, NULL, 26, NULL, 49),
(69, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-10 14:50:55', '2025-07-10 14:50:55', NULL, NULL, 26, NULL, 50),
(70, '5', 5.00, 20000.00, '', 2.50, 0.00, 2.50, 0, '2025-07-10 14:52:10', '2025-07-10 14:52:10', '2025-07-10 14:52:47', NULL, 46, NULL, 60),
(71, '1', 1.00, 4000.00, '', 0.50, 0.00, 0.50, 0, '2025-07-10 14:52:47', '2025-07-10 14:52:47', NULL, NULL, 46, NULL, 60),
(72, '1', 4900.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-11 05:27:12', '2025-07-11 05:27:12', NULL, NULL, 47, NULL, 57),
(73, '1', 1.00, 4000.00, '', 0.00, 0.00, 0.00, 0, '2025-07-11 05:27:12', '2025-07-11 05:27:12', NULL, NULL, 47, NULL, 60),
(74, '5', 5.00, 20000.00, '', 2.50, 0.00, 2.50, 0, '2025-07-11 11:49:20', '2025-07-11 11:49:20', NULL, NULL, 48, NULL, 60),
(91, '3', 297.00, 36.00, '', 163.35, 0.00, 133.65, 0, '2025-07-11 12:58:25', '2025-07-11 12:58:25', NULL, NULL, 57, NULL, 48),
(92, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-11 12:58:25', '2025-07-11 12:58:25', NULL, NULL, 57, NULL, 52),
(93, '1', 199.00, 12.00, '', 59.00, 0.00, 140.00, 0, '2025-07-11 13:46:36', '2025-07-11 13:46:36', NULL, NULL, 58, NULL, 1),
(94, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-11 13:47:38', '2025-07-11 13:47:38', NULL, NULL, 59, NULL, 60),
(95, '5', 495.00, 60.00, '', 272.25, 0.00, 222.75, 0, '2025-07-14 05:37:20', '2025-07-14 05:37:20', NULL, NULL, 60, NULL, 47),
(96, '3', 297.00, 36.00, '', 163.35, 0.00, 133.65, 0, '2025-07-14 05:37:20', '2025-07-14 05:37:20', NULL, NULL, 60, NULL, 48),
(97, '4', 396.00, 48.00, '', 217.80, 0.00, 178.20, 0, '2025-07-14 05:48:41', '2025-07-14 05:48:41', NULL, NULL, 61, NULL, 47),
(98, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-14 05:48:41', '2025-07-14 05:48:41', NULL, NULL, 61, NULL, 52),
(99, '10', 1359.00, 120.00, '', 309.00, 0.00, 1050.00, 0, '2025-07-14 06:30:59', '2025-07-14 06:30:59', NULL, NULL, 62, NULL, 7),
(100, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-14 07:25:58', '2025-07-14 07:25:58', NULL, NULL, 63, NULL, 10),
(101, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-14 07:25:58', '2025-07-14 07:25:58', NULL, NULL, 63, NULL, 52),
(102, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-14 07:51:11', '2025-07-14 07:51:11', NULL, NULL, 64, NULL, 10),
(103, '2', 271.80, 24.00, '', 61.80, 0.00, 210.00, 0, '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, NULL, 65, NULL, 10),
(104, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, NULL, 65, NULL, 46),
(105, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, NULL, 65, NULL, 47),
(106, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, NULL, 65, NULL, 48),
(107, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-14 09:25:09', '2025-07-14 09:25:09', NULL, NULL, 66, NULL, 10),
(108, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:25:09', '2025-07-14 09:25:09', NULL, NULL, 66, NULL, 46),
(109, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:25:09', '2025-07-14 09:25:09', NULL, NULL, 66, NULL, 47),
(110, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, NULL, 67, NULL, 10),
(111, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, NULL, 67, NULL, 46),
(112, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, NULL, 67, NULL, 47),
(113, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, NULL, 67, NULL, 48),
(114, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-14 10:01:07', '2025-07-14 10:01:07', NULL, NULL, 68, NULL, 10),
(115, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 10:01:07', '2025-07-14 10:01:07', NULL, NULL, 68, NULL, 46),
(116, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 10:01:07', '2025-07-14 10:01:07', NULL, NULL, 68, NULL, 47),
(119, '2', 271.80, 24.00, '', 61.80, 0.00, 210.00, 0, '2025-07-14 10:11:32', '2025-07-14 10:11:32', NULL, NULL, 70, NULL, 10),
(120, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-14 10:11:32', '2025-07-14 10:11:32', NULL, NULL, 70, NULL, 46),
(121, '10', 1359.00, 120.00, '', 309.00, 0.00, 1050.00, 0, '2025-07-14 10:15:38', '2025-07-14 10:15:38', NULL, NULL, 71, NULL, 7),
(122, '4', 543.60, 48.00, '', 123.60, 0.00, 420.00, 0, '2025-07-14 10:23:21', '2025-07-14 10:23:21', NULL, NULL, 72, NULL, 10),
(123, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 10:23:21', '2025-07-14 10:23:21', NULL, NULL, 72, NULL, 47),
(124, '3', 330.00, 36.00, '', 181.50, 0.00, 148.50, 0, '2025-07-14 10:23:21', '2025-07-14 10:23:21', NULL, NULL, 72, NULL, 52),
(125, '3', 407.70, 36.00, '', 92.70, 0.00, 315.00, 0, '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, NULL, 73, NULL, 10),
(126, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, NULL, 73, NULL, 47),
(127, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, NULL, 73, NULL, 48),
(128, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, NULL, 73, NULL, 52),
(129, '2', 2.00, 4.00, 'lbs', 1.00, 0.00, 1.00, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', '2025-07-15 01:55:59', 6, 74, NULL, 62),
(130, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 01:55:59', '2025-07-15 01:55:59', '2025-07-15 01:56:00', NULL, 74, NULL, 62),
(131, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 01:56:00', '2025-07-15 01:56:00', '2025-07-15 01:56:35', NULL, 74, NULL, 62),
(132, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 01:56:35', '2025-07-15 01:56:35', NULL, NULL, 74, NULL, 62),
(133, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 04:28:25', '2025-07-15 04:28:25', NULL, NULL, 75, NULL, 40),
(134, '1', 1.00, 2.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 04:34:24', '2025-07-15 04:34:24', NULL, NULL, 76, NULL, 62),
(135, '1', 3600.00, 12.00, 'lbs', 1800.00, 0.00, 1800.00, 0, '2025-07-01 15:28:23', '2025-07-15 04:49:00', NULL, 3, 77, 77, 58),
(136, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 06:10:41', '2025-07-15 06:10:41', '2025-07-15 16:31:15', NULL, 78, NULL, 62),
(137, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 11:28:46', '2025-07-15 11:28:46', NULL, NULL, 79, NULL, 62),
(138, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 11:50:37', '2025-07-15 11:50:37', NULL, NULL, 80, NULL, 43),
(139, '1', 110.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 11:50:37', '2025-07-15 11:50:37', NULL, NULL, 80, NULL, 54),
(140, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 12:57:02', '2025-07-15 12:57:02', NULL, NULL, 81, NULL, 43),
(141, '1', 110.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 12:57:02', '2025-07-15 12:57:02', NULL, NULL, 81, NULL, 50),
(142, '2', 220.00, 24.00, '', 0.00, 0.00, 0.00, 0, '2025-07-15 12:57:02', '2025-07-15 12:57:02', NULL, NULL, 81, NULL, 53),
(143, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 13:00:26', '2025-07-15 13:00:26', NULL, NULL, 82, NULL, 60),
(144, '1', 1.00, 2.00, '', 0.50, 0.00, 0.50, 0, '2025-07-15 13:00:26', '2025-07-15 13:00:26', NULL, NULL, 82, NULL, 62),
(145, '2', 2.00, 8000.00, '', 1.00, 0.00, 1.00, 0, '2025-07-15 13:35:57', '2025-07-15 13:35:57', NULL, NULL, 83, NULL, 60),
(146, '1', 1.00, 2.00, 'lbs', 0.50, 0.00, 0.50, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', NULL, 6, 84, NULL, 62),
(147, '4', 4.00, 8.00, '', 2.00, 0.00, 2.00, 0, '2025-07-15 16:31:15', '2025-07-15 16:31:15', NULL, NULL, 78, NULL, 62),
(148, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 85, NULL, 60),
(149, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 86, NULL, 60),
(150, '1', 4900.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-16 04:57:12', '2025-07-16 04:57:12', NULL, NULL, 87, NULL, 57),
(151, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-16 05:55:43', '2025-07-16 05:55:43', NULL, NULL, 88, NULL, 43),
(152, '1', 4900.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-16 05:55:43', '2025-07-16 05:55:43', NULL, NULL, 88, NULL, 57),
(153, '2', 271.80, 24.00, '', 61.80, 0.00, 210.00, 0, '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, NULL, 89, NULL, 7),
(154, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, NULL, 89, NULL, 46),
(155, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, NULL, 89, NULL, 47),
(156, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, NULL, 89, NULL, 48),
(157, '4', 543.60, 48.00, '', 123.60, 0.00, 420.00, 0, '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, NULL, 90, NULL, 10),
(158, '4', 396.00, 48.00, '', 217.80, 0.00, 178.20, 0, '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, NULL, 90, NULL, 46),
(159, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, NULL, 90, NULL, 47),
(160, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, NULL, 90, NULL, 48),
(161, '2', 271.80, 24.00, '', 61.80, 0.00, 210.00, 0, '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, NULL, 91, NULL, 7),
(162, '5', 495.00, 60.00, '', 272.25, 0.00, 222.75, 0, '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, NULL, 91, NULL, 46),
(163, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, NULL, 91, NULL, 48),
(164, '4', 543.60, 48.00, '', 123.60, 0.00, 420.00, 0, '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, NULL, 92, NULL, 10),
(165, '5', 495.00, 60.00, '', 272.25, 0.00, 222.75, 0, '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, NULL, 92, NULL, 46),
(166, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, NULL, 92, NULL, 47),
(167, '2', 198.00, 24.00, '', 108.90, 0.00, 89.10, 0, '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, NULL, 92, NULL, 48),
(168, '10', 990.00, 120.00, '', 544.50, 0.00, 445.50, 0, '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, NULL, 93, NULL, 46),
(169, '4', 396.00, 48.00, '', 217.80, 0.00, 178.20, 0, '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, NULL, 93, NULL, 47),
(170, '6', 594.00, 72.00, '', 326.70, 0.00, 267.30, 0, '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, NULL, 93, NULL, 48),
(171, '4', 543.60, 48.00, '', 123.60, 0.00, 420.00, 0, '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, NULL, 94, NULL, 10),
(172, '4', 396.00, 48.00, '', 217.80, 0.00, 178.20, 0, '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, NULL, 94, NULL, 46),
(173, '6', 594.00, 72.00, '', 326.70, 0.00, 267.30, 0, '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, NULL, 94, NULL, 47),
(174, '4', 396.00, 48.00, '', 217.80, 0.00, 178.20, 0, '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, NULL, 94, NULL, 48),
(175, '1', 135.90, 12.00, '', 30.90, 0.00, 105.00, 0, '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, NULL, 95, NULL, 10),
(176, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, NULL, 95, NULL, 46),
(177, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, NULL, 95, NULL, 47),
(178, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, NULL, 95, NULL, 48),
(179, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 96, NULL, 60),
(180, '2', 2.00, 4.00, 'lbs', 1.00, 0.00, 1.00, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', NULL, 6, 97, NULL, 62),
(181, '1', 1.00, 2.00, 'lbs', 0.50, 0.00, 0.50, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', '2025-07-16 13:30:27', 6, 98, NULL, 62),
(182, '2', 2.00, 4.00, '', 1.00, 0.00, 1.00, 0, '2025-07-16 13:30:27', '2025-07-16 13:30:27', '2025-07-16 16:39:25', NULL, 98, NULL, 62),
(183, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 99, NULL, 60),
(184, '4', 4.00, 8.00, '', 2.00, 0.00, 2.00, 0, '2025-07-16 16:39:25', '2025-07-16 16:39:25', NULL, NULL, 98, NULL, 62),
(185, '2', 19.48, 24.00, '', 0.00, 0.00, 0.00, 0, '2025-07-17 05:29:38', '2025-07-17 05:29:38', '2025-07-17 12:14:08', NULL, 100, NULL, 43),
(186, '1', 110.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-17 06:56:03', '2025-07-17 06:56:03', NULL, NULL, 101, NULL, 54),
(187, '1', 9.74, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-17 10:43:50', '2025-07-17 10:43:50', NULL, NULL, 102, NULL, 42),
(188, '1', 110.00, 12.00, '', 0.00, 0.00, 0.00, 0, '2025-07-17 10:46:01', '2025-07-17 10:46:01', NULL, NULL, 103, NULL, 54),
(189, '1', 100.00, 12.00, '', 55.00, 0.00, 45.00, 0, '2025-07-17 11:01:57', '2025-07-17 11:01:57', '2025-07-17 11:07:53', NULL, 104, NULL, 51),
(190, '1', 100.00, 12.00, '', 55.00, 0.00, 45.00, 0, '2025-07-17 11:07:53', '2025-07-17 11:07:53', '2025-07-17 11:08:07', NULL, 104, NULL, 51),
(191, '1', 100.00, 12.00, '', 55.00, 0.00, 45.00, 0, '2025-07-17 11:08:07', '2025-07-17 11:08:07', NULL, NULL, 104, NULL, 51),
(192, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-17 11:24:19', '2025-07-17 11:24:19', NULL, NULL, 105, NULL, 43),
(193, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-17 12:00:34', '2025-07-17 12:00:34', NULL, NULL, 106, NULL, 50),
(194, '4', 38.96, 48.00, '', 0.00, 0.00, 0.00, 0, '2025-07-17 12:14:08', '2025-07-17 12:14:08', NULL, NULL, 100, NULL, 43),
(195, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-17 12:17:17', '2025-07-17 12:17:17', '2025-07-17 12:58:19', NULL, 107, NULL, 48),
(196, '1', 99.00, 12.00, '', 54.45, 0.00, 44.55, 0, '2025-07-17 12:58:19', '2025-07-17 12:58:19', NULL, NULL, 107, NULL, 48),
(197, '1', 1.00, 2.00, 'lbs', 0.50, 0.00, 0.50, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', NULL, 6, 108, NULL, 62),
(198, '1', 1.00, 4000.00, 'kg', 0.50, 0.00, 0.50, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 109, NULL, 60),
(199, '2', 2.00, 4.00, 'lbs', 1.00, 0.00, 1.00, 0, '2025-07-09 05:56:01', '2025-07-14 11:28:59', NULL, 6, 110, NULL, 62),
(200, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:48:53', NULL, 4, 111, NULL, 52),
(201, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:58:30', NULL, 4, 111, NULL, 49),
(202, '2', 198.00, 24.00, 'pounds', 108.90, 0.00, 89.10, 0, '2025-07-01 15:24:54', '2025-07-02 10:00:32', NULL, 4, 111, NULL, 47),
(203, '2', 2.00, 8000.00, 'kg', 1.00, 0.00, 1.00, 0, '2025-07-02 09:46:20', '2025-07-04 06:42:42', NULL, 6, 112, NULL, 60),
(204, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-18 04:35:21', '2025-07-18 04:35:21', NULL, NULL, 113, NULL, 50),
(205, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-18 05:35:53', '2025-07-18 05:35:53', '2025-07-18 06:35:48', NULL, 114, NULL, 49),
(206, '12', 66000.00, 144.00, 'lbs', 20400.00, 0.00, 45600.00, 0, '2025-07-01 15:28:23', '2025-07-18 06:29:20', '2025-07-18 06:30:41', 3, 115, 115, 59),
(207, '18', 99000.00, 216.00, '', 30600.00, 0.00, 68400.00, 0, '2025-07-18 06:30:41', '2025-07-18 06:30:41', '2025-07-18 06:30:49', NULL, 115, NULL, 59),
(208, '18', 99000.00, 216.00, '', 30600.00, 0.00, 68400.00, 0, '2025-07-18 06:30:49', '2025-07-18 06:30:49', NULL, NULL, 115, NULL, 59),
(209, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-18 06:35:48', '2025-07-18 06:35:48', '2025-07-18 06:35:58', NULL, 114, NULL, 49),
(210, '4', 440.00, 48.00, '', 242.00, 0.00, 198.00, 0, '2025-07-18 06:35:58', '2025-07-18 06:35:58', NULL, NULL, 114, NULL, 49),
(211, '1', 10.74, 12.00, '', 5.91, 0.00, 4.83, 0, '2025-07-18 08:04:34', '2025-07-18 08:04:34', NULL, NULL, 116, NULL, 31),
(212, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-18 08:07:24', '2025-07-18 08:07:24', '2025-07-18 08:15:17', NULL, 117, NULL, 43),
(213, '5', 48.70, 60.00, '', 26.80, 0.00, 21.90, 0, '2025-07-18 08:15:17', '2025-07-18 08:15:17', '2025-07-18 08:15:17', NULL, 117, NULL, 43),
(214, '5', 48.70, 60.00, '', 26.80, 0.00, 21.90, 0, '2025-07-18 08:15:17', '2025-07-18 08:15:17', '2025-07-18 10:38:43', NULL, 117, NULL, 43),
(215, '9', 87.66, 108.00, '', 48.24, 0.00, 39.42, 0, '2025-07-18 10:38:43', '2025-07-18 10:38:43', NULL, NULL, 117, NULL, 43),
(216, '2', 220.00, 24.00, 'pounds', 121.00, 0.00, 99.00, 0, '2025-07-01 15:24:54', '2025-07-02 09:55:20', NULL, 4, 118, NULL, 53),
(217, '1', 39.00, 12.00, 'pounds', 16.00, 0.00, 23.00, 0, '2025-07-01 15:28:23', '2025-07-02 09:53:13', NULL, 2, 119, NULL, 55),
(218, '1', 110.00, 12.00, 'pounds', 60.50, 0.00, 49.50, 0, '2025-07-01 15:24:54', '2025-07-02 09:56:24', NULL, 4, 119, NULL, 54),
(219, '1', 110.00, 12.00, 'pounds', 60.50, 0.00, 49.50, 0, '2025-07-01 15:24:54', '2025-07-02 09:48:53', NULL, 4, 119, NULL, 52),
(220, '1', 3600.00, 12.00, 'lbs', 1800.00, 0.00, 1800.00, 0, '2025-07-01 15:28:23', '2025-07-01 15:28:23', NULL, 3, 120, NULL, 58),
(221, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 05:51:17', '2025-07-21 05:51:17', '2025-07-21 10:09:14', NULL, 121, NULL, 54),
(222, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 06:09:48', '2025-07-21 06:09:48', NULL, NULL, 122, NULL, 53),
(223, '1', 100.00, 12.00, '', 55.00, 0.00, 45.00, 0, '2025-07-21 09:21:23', '2025-07-21 09:21:23', NULL, NULL, 123, NULL, 51),
(224, '1', 100.00, 12.00, '', 55.00, 0.00, 45.00, 0, '2025-07-21 09:40:54', '2025-07-21 09:40:54', '2025-07-21 09:42:39', NULL, 124, NULL, 51),
(225, '3', 300.00, 36.00, '', 165.00, 0.00, 135.00, 0, '2025-07-21 09:42:39', '2025-07-21 09:42:39', '2025-07-21 10:08:14', NULL, 124, NULL, 51),
(226, '5', 500.00, 60.00, '', 275.00, 0.00, 225.00, 0, '2025-07-21 10:08:14', '2025-07-21 10:08:14', '2025-07-21 10:08:19', NULL, 124, NULL, 51),
(227, '3', 300.00, 36.00, '', 165.00, 0.00, 135.00, 0, '2025-07-21 10:08:19', '2025-07-21 10:08:19', NULL, NULL, 124, NULL, 51),
(228, '5', 550.00, 60.00, '', 302.50, 0.00, 247.50, 0, '2025-07-21 10:09:14', '2025-07-21 10:09:14', '2025-07-21 10:09:15', NULL, 121, NULL, 54),
(229, '5', 550.00, 60.00, '', 302.50, 0.00, 247.50, 0, '2025-07-21 10:09:15', '2025-07-21 10:09:15', NULL, NULL, 121, NULL, 54),
(230, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 10:56:43', '2025-07-21 10:56:43', '2025-07-21 14:27:10', NULL, 125, NULL, 53),
(231, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 10:56:43', '2025-07-21 10:56:43', '2025-07-21 14:27:10', NULL, 125, NULL, 54),
(232, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 14:27:10', '2025-07-21 14:27:10', '2025-07-21 14:42:47', NULL, 125, NULL, 53),
(233, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 14:27:10', '2025-07-21 14:27:10', '2025-07-21 14:42:47', NULL, 125, NULL, 54),
(234, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 14:42:47', '2025-07-21 14:42:47', NULL, NULL, 125, NULL, 53),
(235, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-21 14:42:47', '2025-07-21 14:42:47', NULL, NULL, 125, NULL, 54),
(236, '1', 135.90, 12.00, 'pounds', 30.90, 0.00, 105.00, 0, '2025-07-01 15:18:35', '2025-07-02 09:28:52', NULL, 6, 126, NULL, 10),
(237, '1', 9.74, 12.00, '', 5.36, 0.00, 4.38, 0, '2025-07-22 04:47:58', '2025-07-22 04:47:58', '2025-07-22 05:10:34', NULL, 127, NULL, 43),
(238, '2', 19.48, 24.00, '', 10.72, 0.00, 8.76, 0, '2025-07-22 05:10:34', '2025-07-22 05:10:34', '2025-07-22 05:13:19', NULL, 127, NULL, 43),
(239, '2', 19.48, 24.00, '', 10.72, 0.00, 8.76, 0, '2025-07-22 05:13:19', '2025-07-22 05:13:19', NULL, NULL, 127, NULL, 43),
(240, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-22 05:58:01', '2025-07-22 05:58:01', '2025-07-22 06:18:22', NULL, 128, NULL, 53),
(241, '6', 660.00, 72.00, '', 363.00, 0.00, 297.00, 0, '2025-07-22 06:18:22', '2025-07-22 06:18:22', '2025-07-22 06:18:36', NULL, 128, NULL, 53),
(242, '6', 660.00, 72.00, '', 363.00, 0.00, 297.00, 0, '2025-07-22 06:18:36', '2025-07-22 06:18:36', NULL, NULL, 128, NULL, 53),
(243, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-22 06:25:08', '2025-07-22 06:25:08', NULL, NULL, 129, NULL, 53),
(244, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-22 06:25:08', '2025-07-22 06:25:08', NULL, NULL, 129, NULL, 54),
(245, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-22 06:27:16', '2025-07-22 06:27:16', NULL, NULL, 130, NULL, 53),
(246, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-22 06:27:16', '2025-07-22 06:27:16', NULL, NULL, 130, NULL, 54),
(247, '2', 220.00, 24.00, '', 121.00, 0.00, 99.00, 0, '2025-07-22 06:34:02', '2025-07-22 06:34:02', NULL, NULL, 131, NULL, 49),
(248, '1', 110.00, 12.00, '', 60.50, 0.00, 49.50, 0, '2025-07-22 06:34:02', '2025-07-22 06:34:02', NULL, NULL, 131, NULL, 50);

-- --------------------------------------------------------

--
-- Table structure for table `orderFrequencies`
--

CREATE TABLE `orderFrequencies` (
  `id` int(11) NOT NULL,
  `status` tinyint(1) DEFAULT 1,
  `orderDate` date DEFAULT NULL,
  `nextOrderDate` date DEFAULT NULL,
  `visibilityDate` date DEFAULT NULL,
  `frequency` enum('just-onces','weekly','every-two-weeks','every-four-weeks') DEFAULT 'just-onces',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `addressId` int(11) DEFAULT NULL,
  `orderId` int(11) DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orderFrequencies`
--

INSERT INTO `orderFrequencies` (`id`, `status`, `orderDate`, `nextOrderDate`, `visibilityDate`, `frequency`, `createdAt`, `updatedAt`, `deletedAt`, `addressId`, `orderId`, `salesRepId`, `userId`) VALUES
(4, 1, '2025-07-03', '2025-07-10', '2025-07-07', 'weekly', '2025-07-03 15:11:11', '2025-07-03 15:11:11', NULL, 341, 4, 5, 185),
(77, 1, '2025-07-15', '2025-07-22', '2025-07-19', 'weekly', '2025-07-15 04:49:00', '2025-07-15 04:49:00', NULL, 347, 77, 5, 196),
(115, 1, '2025-07-18', '2025-07-20', '2025-07-18', 'weekly', '2025-07-18 06:29:20', '2025-07-18 06:29:20', NULL, 351, 115, 5, 198);

-- --------------------------------------------------------

--
-- Table structure for table `orderHistories`
--

CREATE TABLE `orderHistories` (
  `id` int(11) NOT NULL,
  `orderStatus` varchar(255) DEFAULT NULL,
  `discription` varchar(255) DEFAULT NULL,
  `on` datetime DEFAULT '2025-07-18 13:40:36',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `orderId` int(11) DEFAULT NULL,
  `statusId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orderHistories`
--

INSERT INTO `orderHistories` (`id`, `orderStatus`, `discription`, `on`, `createdAt`, `updatedAt`, `deletedAt`, `orderId`, `statusId`) VALUES
(1, NULL, NULL, '2025-07-03 13:41:58', '2025-07-03 13:41:58', '2025-07-03 13:41:58', NULL, NULL, 1),
(2, NULL, NULL, '2025-07-03 14:14:25', '2025-07-03 14:14:25', '2025-07-03 14:14:25', NULL, 2, 1),
(3, NULL, NULL, '2025-07-03 14:24:30', '2025-07-03 14:24:30', '2025-07-03 14:24:30', NULL, NULL, 2),
(4, NULL, NULL, '2025-07-03 14:24:41', '2025-07-03 14:24:41', '2025-07-03 14:24:41', NULL, NULL, 3),
(5, NULL, NULL, '2025-07-03 14:25:06', '2025-07-03 14:25:06', '2025-07-03 14:25:06', NULL, NULL, 4),
(6, NULL, NULL, '2025-07-03 14:30:47', '2025-07-03 14:30:47', '2025-07-03 14:30:47', NULL, 3, 1),
(7, NULL, NULL, '2025-07-03 15:11:11', '2025-07-03 15:11:11', '2025-07-03 15:11:11', NULL, 4, 1),
(8, NULL, NULL, '2025-07-03 15:47:31', '2025-07-03 15:47:31', '2025-07-03 15:47:31', NULL, 5, 1),
(9, NULL, NULL, '2025-07-03 16:23:44', '2025-07-03 16:23:44', '2025-07-03 16:23:44', NULL, 6, 1),
(10, NULL, NULL, '2025-07-03 16:36:20', '2025-07-03 16:36:20', '2025-07-03 16:36:20', NULL, 6, 2),
(11, NULL, NULL, '2025-07-03 16:36:39', '2025-07-03 16:36:39', '2025-07-03 16:36:39', NULL, 6, 3),
(12, NULL, NULL, '2025-07-03 16:37:16', '2025-07-03 16:37:16', '2025-07-03 16:37:16', NULL, 6, 4),
(13, NULL, NULL, '2025-07-03 16:37:44', '2025-07-03 16:37:44', '2025-07-03 16:37:44', NULL, 6, 5),
(14, NULL, NULL, '2025-07-03 16:42:33', '2025-07-03 16:42:33', '2025-07-03 16:42:33', NULL, 7, 1),
(15, NULL, NULL, '2025-07-03 16:43:41', '2025-07-03 16:43:41', '2025-07-03 16:43:41', NULL, 7, 2),
(16, NULL, NULL, '2025-07-03 16:43:45', '2025-07-03 16:43:45', '2025-07-03 16:43:45', NULL, 7, 3),
(17, NULL, NULL, '2025-07-03 16:43:56', '2025-07-03 16:43:56', '2025-07-03 16:43:56', NULL, 7, 4),
(18, NULL, NULL, '2025-07-03 16:57:33', '2025-07-03 16:57:33', '2025-07-03 16:57:33', NULL, 8, 1),
(19, NULL, NULL, '2025-07-03 16:59:58', '2025-07-03 16:59:58', '2025-07-03 16:59:58', NULL, 8, 2),
(20, NULL, NULL, '2025-07-03 17:00:05', '2025-07-03 17:00:05', '2025-07-03 17:00:05', NULL, 8, 3),
(21, NULL, NULL, '2025-07-03 17:00:13', '2025-07-03 17:00:13', '2025-07-03 17:00:13', NULL, 8, 4),
(22, NULL, NULL, '2025-07-03 17:00:35', '2025-07-03 17:00:35', '2025-07-03 17:00:35', NULL, 8, 5),
(23, NULL, NULL, '2025-07-04 06:30:35', '2025-07-04 06:30:35', '2025-07-04 06:30:35', NULL, 9, 1),
(24, NULL, NULL, '2025-07-04 07:46:03', '2025-07-04 07:46:03', '2025-07-04 07:46:03', NULL, 8, 4),
(25, NULL, NULL, '2025-07-04 08:30:42', '2025-07-04 08:30:42', '2025-07-04 08:30:42', NULL, 10, 1),
(26, NULL, NULL, '2025-07-04 08:34:54', '2025-07-04 08:34:54', '2025-07-04 08:34:54', NULL, 10, 2),
(27, NULL, NULL, '2025-07-04 08:35:03', '2025-07-04 08:35:03', '2025-07-04 08:35:03', NULL, 10, 3),
(28, NULL, NULL, '2025-07-04 08:35:07', '2025-07-04 08:35:07', '2025-07-04 08:35:07', NULL, 10, 3),
(29, NULL, NULL, '2025-07-04 08:35:14', '2025-07-04 08:35:14', '2025-07-04 08:35:14', NULL, 10, 3),
(30, NULL, NULL, '2025-07-04 08:35:48', '2025-07-04 08:35:48', '2025-07-04 08:35:48', NULL, 10, 4),
(31, NULL, NULL, '2025-07-04 08:42:43', '2025-07-04 08:42:43', '2025-07-04 08:42:43', NULL, 10, 4),
(32, NULL, NULL, '2025-07-04 10:10:42', '2025-07-04 10:10:42', '2025-07-04 10:10:42', NULL, 11, 1),
(33, NULL, NULL, '2025-07-04 13:54:05', '2025-07-04 13:54:05', '2025-07-04 13:54:05', NULL, 12, 1),
(34, NULL, NULL, '2025-07-04 15:06:45', '2025-07-04 15:06:45', '2025-07-04 15:06:45', NULL, 13, 1),
(35, NULL, NULL, '2025-07-04 15:19:58', '2025-07-04 15:19:58', '2025-07-04 15:19:58', NULL, 14, 1),
(36, NULL, NULL, '2025-07-04 15:22:59', '2025-07-04 15:22:59', '2025-07-04 15:22:59', NULL, 15, 1),
(37, NULL, NULL, '2025-07-06 19:30:23', '2025-07-06 19:30:23', '2025-07-06 19:30:23', NULL, 16, 1),
(38, NULL, NULL, '2025-07-06 19:31:09', '2025-07-06 19:31:09', '2025-07-06 19:31:09', NULL, 16, 2),
(39, NULL, NULL, '2025-07-06 19:31:24', '2025-07-06 19:31:24', '2025-07-06 19:31:24', NULL, 16, 3),
(40, NULL, NULL, '2025-07-06 19:31:33', '2025-07-06 19:31:33', '2025-07-06 19:31:33', NULL, 16, 4),
(41, NULL, NULL, '2025-07-07 06:16:59', '2025-07-07 06:16:59', '2025-07-07 06:16:59', NULL, 17, 1),
(42, NULL, NULL, '2025-07-07 06:26:22', '2025-07-07 06:26:22', '2025-07-07 06:26:22', NULL, 18, 1),
(43, NULL, NULL, '2025-07-07 06:28:54', '2025-07-07 06:28:54', '2025-07-07 06:28:54', NULL, 19, 1),
(44, NULL, NULL, '2025-07-07 06:44:12', '2025-07-07 06:44:12', '2025-07-07 06:44:12', NULL, 20, 1),
(45, NULL, NULL, '2025-07-07 07:22:45', '2025-07-07 07:22:45', '2025-07-07 07:22:45', NULL, 21, 1),
(46, NULL, NULL, '2025-07-07 07:46:47', '2025-07-07 07:46:47', '2025-07-07 07:46:47', NULL, 22, 1),
(47, NULL, NULL, '2025-07-07 09:40:48', '2025-07-07 09:40:48', '2025-07-07 09:40:48', NULL, 23, 1),
(48, NULL, NULL, '2025-07-07 10:09:19', '2025-07-07 10:09:19', '2025-07-07 10:09:19', NULL, 23, 2),
(49, NULL, NULL, '2025-07-07 10:09:22', '2025-07-07 10:09:22', '2025-07-07 10:09:22', NULL, 23, 3),
(50, NULL, NULL, '2025-07-07 10:09:33', '2025-07-07 10:09:33', '2025-07-07 10:09:33', NULL, 23, 4),
(51, NULL, NULL, '2025-07-07 10:09:58', '2025-07-07 10:09:58', '2025-07-07 10:09:58', NULL, 23, 5),
(52, NULL, NULL, '2025-07-07 10:09:59', '2025-07-07 10:09:59', '2025-07-07 10:09:59', NULL, 23, 5),
(53, NULL, NULL, '2025-07-07 13:21:55', '2025-07-07 13:21:55', '2025-07-07 13:21:55', NULL, 24, 1),
(54, NULL, NULL, '2025-07-07 13:39:19', '2025-07-07 13:39:19', '2025-07-07 13:39:19', NULL, 25, 1),
(55, NULL, NULL, '2025-07-07 13:42:24', '2025-07-07 13:42:24', '2025-07-07 13:42:24', NULL, 26, 1),
(56, NULL, NULL, '2025-07-07 13:42:24', '2025-07-07 13:42:24', '2025-07-07 13:42:24', NULL, 27, 1),
(57, NULL, NULL, '2025-07-07 13:46:35', '2025-07-07 13:46:35', '2025-07-07 13:46:35', NULL, 27, 2),
(58, NULL, NULL, '2025-07-07 13:46:36', '2025-07-07 13:46:36', '2025-07-07 13:46:36', NULL, 28, 1),
(59, NULL, NULL, '2025-07-07 13:46:46', '2025-07-07 13:46:46', '2025-07-07 13:46:46', NULL, 27, 3),
(60, NULL, NULL, '2025-07-07 13:46:57', '2025-07-07 13:46:57', '2025-07-07 13:46:57', NULL, 27, 4),
(61, NULL, NULL, '2025-07-07 13:48:16', '2025-07-07 13:48:16', '2025-07-07 13:48:16', NULL, 29, 1),
(62, NULL, NULL, '2025-07-07 14:42:37', '2025-07-07 14:42:37', '2025-07-07 14:42:37', NULL, 30, 1),
(63, NULL, NULL, '2025-07-07 14:53:44', '2025-07-07 14:53:44', '2025-07-07 14:53:44', NULL, 31, 1),
(64, NULL, NULL, '2025-07-07 14:55:00', '2025-07-07 14:55:00', '2025-07-07 14:55:00', NULL, 31, 2),
(65, NULL, NULL, '2025-07-07 14:55:05', '2025-07-07 14:55:05', '2025-07-07 14:55:05', NULL, 31, 3),
(66, NULL, NULL, '2025-07-07 14:57:44', '2025-07-07 14:57:44', '2025-07-07 14:57:44', NULL, 31, 4),
(67, NULL, NULL, '2025-07-07 17:21:45', '2025-07-07 17:21:45', '2025-07-07 17:21:45', NULL, 32, 1),
(68, NULL, NULL, '2025-07-07 17:25:14', '2025-07-07 17:25:14', '2025-07-07 17:25:14', NULL, 32, 2),
(69, NULL, NULL, '2025-07-07 17:26:10', '2025-07-07 17:26:10', '2025-07-07 17:26:10', NULL, 32, 3),
(70, NULL, NULL, '2025-07-07 17:26:26', '2025-07-07 17:26:26', '2025-07-07 17:26:26', NULL, 32, 4),
(71, NULL, NULL, '2025-07-07 17:32:04', '2025-07-07 17:32:04', '2025-07-07 17:32:04', NULL, 32, 5),
(72, NULL, NULL, '2025-07-07 17:47:11', '2025-07-07 17:47:11', '2025-07-07 17:47:11', NULL, 33, 1),
(73, NULL, NULL, '2025-07-07 17:47:27', '2025-07-07 17:47:27', '2025-07-07 17:47:27', NULL, 33, 2),
(74, NULL, NULL, '2025-07-07 17:47:31', '2025-07-07 17:47:31', '2025-07-07 17:47:31', NULL, 33, 3),
(75, NULL, NULL, '2025-07-07 17:47:39', '2025-07-07 17:47:39', '2025-07-07 17:47:39', NULL, 33, 4),
(76, NULL, NULL, '2025-07-07 17:55:04', '2025-07-07 17:55:04', '2025-07-07 17:55:04', NULL, 33, 5),
(77, NULL, NULL, '2025-07-08 04:31:28', '2025-07-08 04:31:28', '2025-07-08 04:31:28', NULL, 34, 1),
(78, NULL, NULL, '2025-07-08 04:33:50', '2025-07-08 04:33:50', '2025-07-08 04:33:50', NULL, 35, 1),
(79, NULL, NULL, '2025-07-08 04:40:06', '2025-07-08 04:40:06', '2025-07-08 04:40:06', NULL, 35, 2),
(80, NULL, NULL, '2025-07-08 04:42:45', '2025-07-08 04:42:45', '2025-07-08 04:42:45', NULL, 35, 3),
(81, NULL, NULL, '2025-07-08 04:43:29', '2025-07-08 04:43:29', '2025-07-08 04:43:29', NULL, 35, 4),
(82, NULL, NULL, '2025-07-08 04:43:45', '2025-07-08 04:43:45', '2025-07-08 04:43:45', NULL, 35, 5),
(83, NULL, NULL, '2025-07-08 06:16:28', '2025-07-08 06:16:28', '2025-07-08 06:16:28', NULL, 34, 6),
(84, NULL, NULL, '2025-07-08 06:22:19', '2025-07-08 06:22:19', '2025-07-08 06:22:19', NULL, 36, 1),
(85, NULL, NULL, '2025-07-08 06:25:00', '2025-07-08 06:25:00', '2025-07-08 06:25:00', NULL, 36, 6),
(86, NULL, NULL, '2025-07-08 12:33:50', '2025-07-08 12:33:50', '2025-07-08 12:33:50', NULL, 37, 1),
(87, NULL, NULL, '2025-07-08 14:11:44', '2025-07-08 14:11:44', '2025-07-08 14:11:44', NULL, 38, 1),
(88, NULL, NULL, '2025-07-08 14:12:40', '2025-07-08 14:12:40', '2025-07-08 14:12:40', NULL, 38, 2),
(89, NULL, NULL, '2025-07-08 14:12:43', '2025-07-08 14:12:43', '2025-07-08 14:12:43', NULL, 38, 3),
(90, NULL, NULL, '2025-07-08 14:12:51', '2025-07-08 14:12:51', '2025-07-08 14:12:51', NULL, 38, 4),
(91, NULL, NULL, '2025-07-08 14:13:41', '2025-07-08 14:13:41', '2025-07-08 14:13:41', NULL, 38, 5),
(92, NULL, NULL, '2025-07-09 05:36:05', '2025-07-09 05:36:05', '2025-07-09 05:36:05', NULL, 37, 2),
(93, NULL, NULL, '2025-07-09 05:36:58', '2025-07-09 05:36:58', '2025-07-09 05:36:58', NULL, 37, 3),
(94, NULL, NULL, '2025-07-09 05:37:13', '2025-07-09 05:37:13', '2025-07-09 05:37:13', NULL, 37, 4),
(95, NULL, NULL, '2025-07-09 05:37:24', '2025-07-09 05:37:24', '2025-07-09 05:37:24', NULL, 37, 5),
(96, NULL, NULL, '2025-07-09 05:57:19', '2025-07-09 05:57:19', '2025-07-09 05:57:19', NULL, 39, 1),
(97, NULL, NULL, '2025-07-09 06:24:31', '2025-07-09 06:24:31', '2025-07-09 06:24:31', NULL, 39, 2),
(98, NULL, NULL, '2025-07-09 06:26:23', '2025-07-09 06:26:23', '2025-07-09 06:26:23', NULL, 39, 3),
(99, NULL, NULL, '2025-07-09 06:26:27', '2025-07-09 06:26:27', '2025-07-09 06:26:27', NULL, 39, 6),
(100, NULL, NULL, '2025-07-09 07:43:10', '2025-07-09 07:43:10', '2025-07-09 07:43:10', NULL, 40, 1),
(101, NULL, NULL, '2025-07-09 10:06:24', '2025-07-09 10:06:24', '2025-07-09 10:06:24', NULL, 41, 1),
(102, NULL, NULL, '2025-07-09 10:08:19', '2025-07-09 10:08:19', '2025-07-09 10:08:19', NULL, 42, 1),
(103, NULL, NULL, '2025-07-09 10:09:54', '2025-07-09 10:09:54', '2025-07-09 10:09:54', NULL, 43, 1),
(104, NULL, NULL, '2025-07-09 14:13:46', '2025-07-09 14:13:46', '2025-07-09 14:13:46', NULL, 44, 1),
(105, NULL, NULL, '2025-07-09 14:23:16', '2025-07-09 14:23:16', '2025-07-09 14:23:16', NULL, 45, 1),
(106, NULL, NULL, '2025-07-10 14:23:17', '2025-07-10 14:23:17', '2025-07-10 14:23:17', NULL, 46, 1),
(107, NULL, NULL, '2025-07-11 05:27:12', '2025-07-11 05:27:12', '2025-07-11 05:27:12', NULL, 47, 1),
(108, NULL, NULL, '2025-07-11 05:41:43', '2025-07-11 05:41:43', '2025-07-11 05:41:43', NULL, 47, 2),
(109, NULL, NULL, '2025-07-11 05:41:47', '2025-07-11 05:41:47', '2025-07-11 05:41:47', NULL, 47, 3),
(110, NULL, NULL, '2025-07-11 05:41:56', '2025-07-11 05:41:56', '2025-07-11 05:41:56', NULL, 47, 4),
(111, NULL, NULL, '2025-07-11 05:42:01', '2025-07-11 05:42:01', '2025-07-11 05:42:01', NULL, 47, 5),
(112, NULL, NULL, '2025-07-11 11:25:48', '2025-07-11 11:25:48', '2025-07-11 11:25:48', NULL, 45, 2),
(113, NULL, NULL, '2025-07-11 11:25:52', '2025-07-11 11:25:52', '2025-07-11 11:25:52', NULL, 45, 3),
(114, NULL, NULL, '2025-07-11 11:49:20', '2025-07-11 11:49:20', '2025-07-11 11:49:20', NULL, 48, 1),
(115, NULL, NULL, '2025-07-11 12:06:09', '2025-07-11 12:06:09', '2025-07-11 12:06:09', NULL, NULL, 1),
(116, NULL, NULL, '2025-07-11 12:17:33', '2025-07-11 12:17:33', '2025-07-11 12:17:33', NULL, NULL, 1),
(117, NULL, NULL, '2025-07-11 12:17:50', '2025-07-11 12:17:50', '2025-07-11 12:17:50', NULL, NULL, 1),
(118, NULL, NULL, '2025-07-11 12:18:21', '2025-07-11 12:18:21', '2025-07-11 12:18:21', NULL, NULL, 1),
(119, NULL, NULL, '2025-07-11 12:32:40', '2025-07-11 12:32:40', '2025-07-11 12:32:40', NULL, NULL, 1),
(120, NULL, NULL, '2025-07-11 12:44:35', '2025-07-11 12:44:35', '2025-07-11 12:44:35', NULL, NULL, 1),
(121, NULL, NULL, '2025-07-11 12:52:40', '2025-07-11 12:52:40', '2025-07-11 12:52:40', NULL, NULL, 1),
(122, NULL, NULL, '2025-07-11 12:54:20', '2025-07-11 12:54:20', '2025-07-11 12:54:20', NULL, NULL, 1),
(123, NULL, NULL, '2025-07-11 12:58:25', '2025-07-11 12:58:25', '2025-07-11 12:58:25', NULL, 57, 1),
(124, NULL, NULL, '2025-07-11 13:46:35', '2025-07-11 13:46:36', '2025-07-11 13:46:36', NULL, 58, 1),
(125, NULL, NULL, '2025-07-11 13:47:38', '2025-07-11 13:47:38', '2025-07-11 13:47:38', NULL, 59, 1),
(126, NULL, NULL, '2025-07-14 05:37:20', '2025-07-14 05:37:20', '2025-07-14 05:37:20', NULL, 60, 1),
(127, NULL, NULL, '2025-07-14 05:48:41', '2025-07-14 05:48:41', '2025-07-14 05:48:41', NULL, 61, 1),
(128, NULL, NULL, '2025-07-14 06:30:59', '2025-07-14 06:30:59', '2025-07-14 06:30:59', NULL, 62, 1),
(129, NULL, NULL, '2025-07-14 07:25:58', '2025-07-14 07:25:58', '2025-07-14 07:25:58', NULL, 63, 1),
(130, NULL, NULL, '2025-07-14 07:51:11', '2025-07-14 07:51:11', '2025-07-14 07:51:11', NULL, 64, 1),
(131, NULL, NULL, '2025-07-14 09:15:01', '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, 65, 1),
(132, NULL, NULL, '2025-07-14 09:25:09', '2025-07-14 09:25:09', '2025-07-14 09:25:09', NULL, 66, 1),
(133, NULL, NULL, '2025-07-14 09:43:20', '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, 67, 1),
(134, NULL, NULL, '2025-07-14 10:01:07', '2025-07-14 10:01:07', '2025-07-14 10:01:07', NULL, 68, 1),
(135, NULL, NULL, '2025-07-14 10:08:55', '2025-07-14 10:08:55', '2025-07-14 10:08:55', NULL, NULL, 1),
(136, NULL, NULL, '2025-07-14 10:11:32', '2025-07-14 10:11:32', '2025-07-14 10:11:32', NULL, 70, 1),
(137, NULL, NULL, '2025-07-14 10:15:38', '2025-07-14 10:15:38', '2025-07-14 10:15:38', NULL, 71, 1),
(138, NULL, NULL, '2025-07-14 10:23:21', '2025-07-14 10:23:21', '2025-07-14 10:23:21', NULL, 72, 1),
(139, NULL, NULL, '2025-07-14 11:21:58', '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, 73, 1),
(140, NULL, NULL, '2025-07-14 12:00:12', '2025-07-14 12:00:12', '2025-07-14 12:00:12', NULL, 2, 2),
(141, NULL, NULL, '2025-07-14 12:00:24', '2025-07-14 12:00:24', '2025-07-14 12:00:24', NULL, 2, 6),
(142, NULL, NULL, '2025-07-14 12:10:05', '2025-07-14 12:10:05', '2025-07-14 12:10:05', NULL, 7, 5),
(143, NULL, NULL, '2025-07-15 01:52:47', '2025-07-15 01:52:47', '2025-07-15 01:52:47', NULL, 74, 1),
(144, NULL, NULL, '2025-07-15 01:53:07', '2025-07-15 01:53:07', '2025-07-15 01:53:07', NULL, 74, 2),
(145, NULL, NULL, '2025-07-15 01:53:18', '2025-07-15 01:53:18', '2025-07-15 01:53:18', NULL, 74, 3),
(146, NULL, NULL, '2025-07-15 02:09:11', '2025-07-15 02:09:11', '2025-07-15 02:09:11', NULL, 74, 4),
(147, NULL, NULL, '2025-07-15 04:28:25', '2025-07-15 04:28:25', '2025-07-15 04:28:25', NULL, 75, 1),
(148, NULL, NULL, '2025-07-15 04:34:24', '2025-07-15 04:34:24', '2025-07-15 04:34:24', NULL, 76, 1),
(149, NULL, NULL, '2025-07-15 04:49:00', '2025-07-15 04:49:00', '2025-07-15 04:49:00', NULL, 77, 1),
(150, NULL, NULL, '2025-07-15 04:49:28', '2025-07-15 04:49:28', '2025-07-15 04:49:28', NULL, 77, 2),
(151, NULL, NULL, '2025-07-15 04:49:46', '2025-07-15 04:49:46', '2025-07-15 04:49:46', NULL, 77, 3),
(152, NULL, NULL, '2025-07-15 05:17:25', '2025-07-15 05:17:25', '2025-07-15 05:17:25', NULL, 70, 2),
(153, NULL, NULL, '2025-07-15 05:17:41', '2025-07-15 05:17:41', '2025-07-15 05:17:41', NULL, 70, 3),
(154, NULL, NULL, '2025-07-15 06:10:41', '2025-07-15 06:10:41', '2025-07-15 06:10:41', NULL, 78, 1),
(155, NULL, NULL, '2025-07-15 11:28:46', '2025-07-15 11:28:46', '2025-07-15 11:28:46', NULL, 79, 1),
(156, NULL, NULL, '2025-07-15 11:50:37', '2025-07-15 11:50:37', '2025-07-15 11:50:37', NULL, 80, 1),
(157, NULL, NULL, '2025-07-15 12:57:02', '2025-07-15 12:57:02', '2025-07-15 12:57:02', NULL, 81, 1),
(158, NULL, NULL, '2025-07-15 13:00:26', '2025-07-15 13:00:26', '2025-07-15 13:00:26', NULL, 82, 1),
(159, NULL, NULL, '2025-07-15 13:35:57', '2025-07-15 13:35:57', '2025-07-15 13:35:57', NULL, 83, 1),
(160, NULL, NULL, '2025-07-15 13:35:57', '2025-07-15 13:35:57', '2025-07-15 13:35:57', NULL, 83, 2),
(161, NULL, NULL, '2025-07-15 13:46:49', '2025-07-15 13:46:49', '2025-07-15 13:46:49', NULL, 84, 1),
(162, NULL, NULL, '2025-07-15 13:46:49', '2025-07-15 13:46:49', '2025-07-15 13:46:49', NULL, 84, 2),
(163, NULL, NULL, '2025-07-15 21:35:19', '2025-07-15 21:35:19', '2025-07-15 21:35:19', NULL, 85, 1),
(164, NULL, NULL, '2025-07-15 21:35:19', '2025-07-15 21:35:19', '2025-07-15 21:35:19', NULL, 85, 2),
(165, NULL, NULL, '2025-07-15 21:35:34', '2025-07-15 21:35:34', '2025-07-15 21:35:34', NULL, 85, 3),
(166, NULL, NULL, '2025-07-15 21:51:33', '2025-07-15 21:51:33', '2025-07-15 21:51:33', NULL, 85, 4),
(167, NULL, NULL, '2025-07-15 22:12:27', '2025-07-15 22:12:27', '2025-07-15 22:12:27', NULL, 86, 1),
(168, NULL, NULL, '2025-07-15 22:12:27', '2025-07-15 22:12:27', '2025-07-15 22:12:27', NULL, 86, 2),
(169, NULL, NULL, '2025-07-15 22:12:43', '2025-07-15 22:12:43', '2025-07-15 22:12:43', NULL, 86, 3),
(170, NULL, NULL, '2025-07-15 22:16:09', '2025-07-15 22:16:09', '2025-07-15 22:16:09', NULL, 86, 4),
(171, NULL, NULL, '2025-07-16 04:57:12', '2025-07-16 04:57:12', '2025-07-16 04:57:12', NULL, 87, 1),
(172, NULL, NULL, '2025-07-16 04:57:12', '2025-07-16 04:57:12', '2025-07-16 04:57:12', NULL, 87, 2),
(173, NULL, NULL, '2025-07-16 05:55:43', '2025-07-16 05:55:43', '2025-07-16 05:55:43', NULL, 88, 1),
(174, NULL, NULL, '2025-07-16 05:55:43', '2025-07-16 05:55:43', '2025-07-16 05:55:43', NULL, 88, 2),
(175, NULL, NULL, '2025-07-16 06:20:06', '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, 89, 1),
(176, NULL, NULL, '2025-07-16 06:20:06', '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, 89, 2),
(177, NULL, NULL, '2025-07-16 06:43:15', '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, 90, 1),
(178, NULL, NULL, '2025-07-16 06:43:15', '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, 90, 2),
(179, NULL, NULL, '2025-07-16 07:38:28', '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, 91, 1),
(180, NULL, NULL, '2025-07-16 07:38:28', '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, 91, 2),
(181, NULL, NULL, '2025-07-16 07:54:22', '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, 92, 1),
(182, NULL, NULL, '2025-07-16 07:54:22', '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, 92, 2),
(183, NULL, NULL, '2025-07-16 09:19:21', '2025-07-16 09:19:21', '2025-07-16 09:19:21', NULL, 83, 3),
(184, NULL, NULL, '2025-07-16 10:05:14', '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, 93, 1),
(185, NULL, NULL, '2025-07-16 10:05:14', '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, 93, 2),
(186, NULL, NULL, '2025-07-16 10:28:38', '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, 94, 1),
(187, NULL, NULL, '2025-07-16 10:28:38', '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, 94, 2),
(188, NULL, NULL, '2025-07-16 11:18:31', '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, 95, 1),
(189, NULL, NULL, '2025-07-16 11:18:31', '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, 95, 2),
(190, NULL, NULL, '2025-07-16 13:23:19', '2025-07-16 13:23:19', '2025-07-16 13:23:19', NULL, 96, 1),
(191, NULL, NULL, '2025-07-16 13:23:19', '2025-07-16 13:23:19', '2025-07-16 13:23:19', NULL, 96, 2),
(192, NULL, NULL, '2025-07-16 13:26:55', '2025-07-16 13:26:55', '2025-07-16 13:26:55', NULL, 97, 1),
(193, NULL, NULL, '2025-07-16 13:26:55', '2025-07-16 13:26:55', '2025-07-16 13:26:55', NULL, 97, 2),
(194, NULL, NULL, '2025-07-16 13:27:08', '2025-07-16 13:27:08', '2025-07-16 13:27:08', NULL, 98, 1),
(195, NULL, NULL, '2025-07-16 13:27:08', '2025-07-16 13:27:08', '2025-07-16 13:27:08', NULL, 98, 2),
(196, NULL, NULL, '2025-07-16 13:28:38', '2025-07-16 13:28:38', '2025-07-16 13:28:38', NULL, 98, 3),
(197, NULL, NULL, '2025-07-16 13:28:53', '2025-07-16 13:28:53', '2025-07-16 13:28:53', NULL, 98, 4),
(198, NULL, NULL, '2025-07-16 15:40:54', '2025-07-16 15:40:54', '2025-07-16 15:40:54', NULL, 97, 3),
(199, NULL, NULL, '2025-07-16 15:41:03', '2025-07-16 15:41:03', '2025-07-16 15:41:03', NULL, 97, 4),
(200, NULL, NULL, '2025-07-16 16:28:25', '2025-07-16 16:28:25', '2025-07-16 16:28:25', NULL, 99, 1),
(201, NULL, NULL, '2025-07-16 16:28:25', '2025-07-16 16:28:25', '2025-07-16 16:28:25', NULL, 99, 2),
(202, NULL, NULL, '2025-07-16 16:33:12', '2025-07-16 16:33:12', '2025-07-16 16:33:12', NULL, 99, 3),
(203, NULL, NULL, '2025-07-17 05:08:27', '2025-07-17 05:08:27', '2025-07-17 05:08:27', NULL, 81, 2),
(204, NULL, NULL, '2025-07-17 05:09:29', '2025-07-17 05:09:29', '2025-07-17 05:09:29', NULL, 81, 3),
(205, NULL, NULL, '2025-07-17 05:19:52', '2025-07-17 05:19:52', '2025-07-17 05:19:52', NULL, 80, 2),
(206, NULL, NULL, '2025-07-17 05:29:38', '2025-07-17 05:29:38', '2025-07-17 05:29:38', NULL, 100, 1),
(207, NULL, NULL, '2025-07-17 05:29:38', '2025-07-17 05:29:38', '2025-07-17 05:29:38', NULL, 100, 2),
(208, NULL, NULL, '2025-07-17 05:30:25', '2025-07-17 05:30:25', '2025-07-17 05:30:25', NULL, 100, 3),
(209, NULL, NULL, '2025-07-17 05:31:25', '2025-07-17 05:31:25', '2025-07-17 05:31:25', NULL, 3, 2),
(210, NULL, NULL, '2025-07-17 05:33:07', '2025-07-17 05:33:07', '2025-07-17 05:33:07', NULL, 3, 3),
(211, NULL, NULL, '2025-07-17 05:34:33', '2025-07-17 05:34:33', '2025-07-17 05:34:33', NULL, 3, 4),
(212, NULL, NULL, '2025-07-17 06:31:04', '2025-07-17 06:31:04', '2025-07-17 06:31:04', NULL, 80, 3),
(213, NULL, NULL, '2025-07-17 06:39:26', '2025-07-17 06:39:26', '2025-07-17 06:39:26', NULL, 99, 5),
(214, NULL, NULL, '2025-07-17 06:56:02', '2025-07-17 06:56:02', '2025-07-17 06:56:02', NULL, 101, 1),
(215, NULL, NULL, '2025-07-17 06:56:02', '2025-07-17 06:56:02', '2025-07-17 06:56:02', NULL, 101, 2),
(216, NULL, NULL, '2025-07-17 10:43:50', '2025-07-17 10:43:50', '2025-07-17 10:43:50', NULL, 102, 1),
(217, NULL, NULL, '2025-07-17 10:43:50', '2025-07-17 10:43:50', '2025-07-17 10:43:50', NULL, 102, 2),
(218, NULL, NULL, '2025-07-17 10:46:01', '2025-07-17 10:46:01', '2025-07-17 10:46:01', NULL, 103, 1),
(219, NULL, NULL, '2025-07-17 10:46:01', '2025-07-17 10:46:01', '2025-07-17 10:46:01', NULL, 103, 2),
(220, NULL, NULL, '2025-07-17 10:47:44', '2025-07-17 10:47:44', '2025-07-17 10:47:44', NULL, 103, 3),
(221, NULL, NULL, '2025-07-17 10:54:42', '2025-07-17 10:54:42', '2025-07-17 10:54:42', NULL, 102, 3),
(222, NULL, NULL, '2025-07-17 10:54:54', '2025-07-17 10:54:54', '2025-07-17 10:54:54', NULL, 102, 4),
(223, NULL, NULL, '2025-07-17 11:01:57', '2025-07-17 11:01:57', '2025-07-17 11:01:57', NULL, 104, 1),
(224, NULL, NULL, '2025-07-17 11:01:57', '2025-07-17 11:01:57', '2025-07-17 11:01:57', NULL, 104, 2),
(225, NULL, NULL, '2025-07-17 11:09:45', '2025-07-17 11:09:45', '2025-07-17 11:09:45', NULL, 104, 3),
(226, NULL, NULL, '2025-07-17 11:10:13', '2025-07-17 11:10:13', '2025-07-17 11:10:13', NULL, 104, 4),
(227, NULL, NULL, '2025-07-17 11:14:48', '2025-07-17 11:14:48', '2025-07-17 11:14:48', NULL, 104, 5),
(228, NULL, NULL, '2025-07-17 11:15:59', '2025-07-17 11:15:59', '2025-07-17 11:15:59', NULL, 101, 3),
(229, NULL, NULL, '2025-07-17 11:22:17', '2025-07-17 11:22:17', '2025-07-17 11:22:17', NULL, 101, 4),
(230, NULL, NULL, '2025-07-17 11:23:17', '2025-07-17 11:23:17', '2025-07-17 11:23:17', NULL, 102, 5),
(231, NULL, NULL, '2025-07-17 11:23:41', '2025-07-17 11:23:41', '2025-07-17 11:23:41', NULL, 96, 3),
(232, NULL, NULL, '2025-07-17 11:24:19', '2025-07-17 11:24:19', '2025-07-17 11:24:19', NULL, 105, 1),
(233, NULL, NULL, '2025-07-17 11:24:19', '2025-07-17 11:24:19', '2025-07-17 11:24:19', NULL, 105, 2),
(234, NULL, NULL, '2025-07-17 11:24:52', '2025-07-17 11:24:52', '2025-07-17 11:24:52', NULL, 105, 3),
(235, NULL, NULL, '2025-07-17 11:24:53', '2025-07-17 11:24:53', '2025-07-17 11:24:53', NULL, 105, 3),
(236, NULL, NULL, '2025-07-17 11:25:01', '2025-07-17 11:25:01', '2025-07-17 11:25:01', NULL, 105, 4),
(237, NULL, NULL, '2025-07-17 11:25:03', '2025-07-17 11:25:03', '2025-07-17 11:25:03', NULL, 105, 5),
(238, NULL, NULL, '2025-07-17 12:00:34', '2025-07-17 12:00:34', '2025-07-17 12:00:34', NULL, 106, 1),
(239, NULL, NULL, '2025-07-17 12:00:34', '2025-07-17 12:00:34', '2025-07-17 12:00:34', NULL, 106, 2),
(240, NULL, NULL, '2025-07-17 12:17:17', '2025-07-17 12:17:17', '2025-07-17 12:17:17', NULL, 107, 1),
(241, NULL, NULL, '2025-07-17 12:17:17', '2025-07-17 12:17:17', '2025-07-17 12:17:17', NULL, 107, 2),
(242, NULL, NULL, '2025-07-17 12:22:14', '2025-07-17 12:22:14', '2025-07-17 12:22:14', NULL, 107, 3),
(243, NULL, NULL, '2025-07-17 12:22:21', '2025-07-17 12:22:21', '2025-07-17 12:22:21', NULL, 107, 4),
(244, NULL, NULL, '2025-07-17 12:48:06', '2025-07-17 12:48:06', '2025-07-17 12:48:06', NULL, 107, 5),
(245, NULL, NULL, '2025-07-17 12:49:55', '2025-07-17 12:49:55', '2025-07-17 12:49:55', NULL, 107, 5),
(246, NULL, NULL, '2025-07-17 13:45:00', '2025-07-17 13:45:00', '2025-07-17 13:45:00', NULL, 108, 1),
(247, NULL, NULL, '2025-07-17 13:45:00', '2025-07-17 13:45:00', '2025-07-17 13:45:00', NULL, 108, 2),
(248, NULL, NULL, '2025-07-17 13:48:04', '2025-07-17 13:48:04', '2025-07-17 13:48:04', NULL, 109, 1),
(249, NULL, NULL, '2025-07-17 13:48:04', '2025-07-17 13:48:04', '2025-07-17 13:48:04', NULL, 109, 2),
(250, NULL, NULL, '2025-07-17 13:52:28', '2025-07-17 13:52:28', '2025-07-17 13:52:28', NULL, 110, 1),
(251, NULL, NULL, '2025-07-17 13:52:28', '2025-07-17 13:52:28', '2025-07-17 13:52:28', NULL, 110, 2),
(252, NULL, NULL, '2025-07-17 15:13:22', '2025-07-17 15:13:22', '2025-07-17 15:13:22', NULL, 111, 1),
(253, NULL, NULL, '2025-07-17 15:13:22', '2025-07-17 15:13:22', '2025-07-17 15:13:22', NULL, 111, 2),
(254, NULL, NULL, '2025-07-17 15:14:07', '2025-07-17 15:14:07', '2025-07-17 15:14:07', NULL, 111, 3),
(255, NULL, NULL, '2025-07-17 15:14:28', '2025-07-17 15:14:28', '2025-07-17 15:14:28', NULL, 111, 4),
(256, NULL, NULL, '2025-07-17 15:14:56', '2025-07-17 15:14:56', '2025-07-17 15:14:56', NULL, 111, 5),
(257, NULL, NULL, '2025-07-17 20:41:42', '2025-07-17 20:41:42', '2025-07-17 20:41:42', NULL, 112, 1),
(258, NULL, NULL, '2025-07-17 20:41:42', '2025-07-17 20:41:42', '2025-07-17 20:41:42', NULL, 112, 2),
(259, NULL, NULL, '2025-07-17 20:42:30', '2025-07-17 20:42:30', '2025-07-17 20:42:30', NULL, 112, 3),
(260, NULL, NULL, '2025-07-17 20:42:41', '2025-07-17 20:42:41', '2025-07-17 20:42:41', NULL, 112, 4),
(261, NULL, NULL, '2025-07-17 20:43:15', '2025-07-17 20:43:15', '2025-07-17 20:43:15', NULL, 112, 5),
(262, NULL, NULL, '2025-07-17 23:23:04', '2025-07-17 23:23:04', '2025-07-17 23:23:04', NULL, 98, 5),
(263, NULL, NULL, '2025-07-17 23:23:49', '2025-07-17 23:23:49', '2025-07-17 23:23:49', NULL, 3, 5),
(264, NULL, NULL, '2025-07-18 04:35:21', '2025-07-18 04:35:21', '2025-07-18 04:35:21', NULL, 113, 1),
(265, NULL, NULL, '2025-07-18 04:35:21', '2025-07-18 04:35:21', '2025-07-18 04:35:21', NULL, 113, 2),
(266, NULL, NULL, '2025-07-18 05:35:53', '2025-07-18 05:35:53', '2025-07-18 05:35:53', NULL, 114, 1),
(267, NULL, NULL, '2025-07-18 05:35:53', '2025-07-18 05:35:53', '2025-07-18 05:35:53', NULL, 114, 2),
(268, NULL, NULL, '2025-07-18 05:39:57', '2025-07-18 05:39:57', '2025-07-18 05:39:57', NULL, 114, 3),
(269, NULL, NULL, '2025-07-18 05:42:26', '2025-07-18 05:42:26', '2025-07-18 05:42:26', NULL, 114, 4),
(270, NULL, NULL, '2025-07-18 05:42:44', '2025-07-18 05:42:44', '2025-07-18 05:42:44', NULL, 106, 3),
(271, NULL, NULL, '2025-07-18 05:47:17', '2025-07-18 05:47:17', '2025-07-18 05:47:17', NULL, 106, 4),
(272, NULL, NULL, '2025-07-18 06:29:20', '2025-07-18 06:29:20', '2025-07-18 06:29:20', NULL, 115, 1),
(273, NULL, NULL, '2025-07-18 06:29:20', '2025-07-18 06:29:20', '2025-07-18 06:29:20', NULL, 115, 2),
(274, NULL, NULL, '2025-07-18 08:04:34', '2025-07-18 08:04:34', '2025-07-18 08:04:34', NULL, 116, 1),
(275, NULL, NULL, '2025-07-18 08:04:34', '2025-07-18 08:04:34', '2025-07-18 08:04:34', NULL, 116, 2),
(276, NULL, NULL, '2025-07-18 08:07:24', '2025-07-18 08:07:24', '2025-07-18 08:07:24', NULL, 117, 1),
(277, NULL, NULL, '2025-07-18 08:07:24', '2025-07-18 08:07:24', '2025-07-18 08:07:24', NULL, 117, 2),
(278, NULL, NULL, '2025-07-18 08:09:50', '2025-07-18 08:09:50', '2025-07-18 08:09:50', NULL, 117, 3),
(279, NULL, NULL, '2025-07-18 08:10:02', '2025-07-18 08:10:02', '2025-07-18 08:10:02', NULL, 117, 4),
(280, NULL, NULL, '2025-07-18 08:14:38', '2025-07-18 08:14:38', '2025-07-18 08:14:38', NULL, 117, 5),
(281, NULL, NULL, '2025-07-18 10:31:08', '2025-07-18 10:31:08', '2025-07-18 10:31:08', NULL, 116, 3),
(282, NULL, NULL, '2025-07-18 17:29:27', '2025-07-18 17:29:27', '2025-07-18 17:29:27', NULL, 118, 1),
(283, NULL, NULL, '2025-07-18 17:29:27', '2025-07-18 17:29:27', '2025-07-18 17:29:27', NULL, 118, 2),
(284, NULL, NULL, '2025-07-18 17:31:42', '2025-07-18 17:31:42', '2025-07-18 17:31:42', NULL, 118, 3),
(285, NULL, NULL, '2025-07-18 17:32:50', '2025-07-18 17:32:50', '2025-07-18 17:32:50', NULL, 118, 4),
(286, NULL, NULL, '2025-07-18 17:38:14', '2025-07-18 17:38:14', '2025-07-18 17:38:14', NULL, 119, 1),
(287, NULL, NULL, '2025-07-18 17:38:14', '2025-07-18 17:38:14', '2025-07-18 17:38:14', NULL, 119, 2),
(288, NULL, NULL, '2025-07-18 17:41:12', '2025-07-18 17:41:12', '2025-07-18 17:41:12', NULL, 119, 3),
(289, NULL, NULL, '2025-07-18 17:41:30', '2025-07-18 17:41:30', '2025-07-18 17:41:30', NULL, 119, 4),
(290, NULL, NULL, '2025-07-18 18:14:09', '2025-07-18 18:14:09', '2025-07-18 18:14:09', NULL, 119, 5),
(291, NULL, NULL, '2025-07-19 12:55:20', '2025-07-19 12:55:20', '2025-07-19 12:55:20', NULL, 120, 1),
(292, NULL, NULL, '2025-07-19 12:55:20', '2025-07-19 12:55:20', '2025-07-19 12:55:20', NULL, 120, 2),
(293, NULL, NULL, '2025-07-19 20:15:37', '2025-07-19 20:15:37', '2025-07-19 20:15:37', NULL, 120, 3),
(294, NULL, NULL, '2025-07-19 20:15:43', '2025-07-19 20:15:43', '2025-07-19 20:15:43', NULL, 120, 4),
(295, NULL, NULL, '2025-07-21 05:51:17', '2025-07-21 05:51:17', '2025-07-21 05:51:17', NULL, 121, 1),
(296, NULL, NULL, '2025-07-21 05:51:17', '2025-07-21 05:51:17', '2025-07-21 05:51:17', NULL, 121, 2),
(297, NULL, NULL, '2025-07-21 06:09:48', '2025-07-21 06:09:48', '2025-07-21 06:09:48', NULL, 122, 1),
(298, NULL, NULL, '2025-07-21 06:09:48', '2025-07-21 06:09:48', '2025-07-21 06:09:48', NULL, 122, 2),
(299, NULL, NULL, '2025-07-21 06:25:06', '2025-07-21 06:25:06', '2025-07-21 06:25:06', NULL, 122, 3),
(300, NULL, NULL, '2025-07-21 06:25:15', '2025-07-21 06:25:15', '2025-07-21 06:25:15', NULL, 122, 4),
(301, NULL, NULL, '2025-07-21 06:26:00', '2025-07-21 06:26:00', '2025-07-21 06:26:00', NULL, 122, 5),
(302, NULL, NULL, '2025-07-21 06:35:20', '2025-07-21 06:35:20', '2025-07-21 06:35:20', NULL, 121, 3),
(303, NULL, NULL, '2025-07-21 06:36:52', '2025-07-21 06:36:52', '2025-07-21 06:36:52', NULL, 121, 4),
(304, NULL, NULL, '2025-07-21 07:35:43', '2025-07-21 07:35:43', '2025-07-21 07:35:43', NULL, 121, 5),
(305, NULL, NULL, '2025-07-21 09:19:47', '2025-07-21 09:19:47', '2025-07-21 09:19:47', NULL, 106, 5),
(306, NULL, NULL, '2025-07-21 09:21:23', '2025-07-21 09:21:23', '2025-07-21 09:21:23', NULL, 123, 1),
(307, NULL, NULL, '2025-07-21 09:21:23', '2025-07-21 09:21:23', '2025-07-21 09:21:23', NULL, 123, 2),
(308, NULL, NULL, '2025-07-21 09:28:10', '2025-07-21 09:28:10', '2025-07-21 09:28:10', NULL, 123, 3),
(309, NULL, NULL, '2025-07-21 09:28:16', '2025-07-21 09:28:16', '2025-07-21 09:28:16', NULL, 123, 4),
(310, NULL, NULL, '2025-07-21 09:40:54', '2025-07-21 09:40:54', '2025-07-21 09:40:54', NULL, 124, 1),
(311, NULL, NULL, '2025-07-21 09:40:54', '2025-07-21 09:40:54', '2025-07-21 09:40:54', NULL, 124, 2),
(312, NULL, NULL, '2025-07-21 09:41:51', '2025-07-21 09:41:51', '2025-07-21 09:41:51', NULL, 124, 3),
(313, NULL, NULL, '2025-07-21 09:42:03', '2025-07-21 09:42:03', '2025-07-21 09:42:03', NULL, 124, 4),
(314, NULL, NULL, '2025-07-21 09:42:07', '2025-07-21 09:42:07', '2025-07-21 09:42:07', NULL, 124, 5),
(315, NULL, NULL, '2025-07-21 09:46:21', '2025-07-21 09:46:21', '2025-07-21 09:46:21', NULL, 115, 3),
(316, NULL, NULL, '2025-07-21 09:46:29', '2025-07-21 09:46:29', '2025-07-21 09:46:29', NULL, 115, 4),
(317, NULL, NULL, '2025-07-21 09:47:40', '2025-07-21 09:47:40', '2025-07-21 09:47:40', NULL, 123, 5),
(318, NULL, NULL, '2025-07-21 10:56:43', '2025-07-21 10:56:43', '2025-07-21 10:56:43', NULL, 125, 1),
(319, NULL, NULL, '2025-07-21 10:56:43', '2025-07-21 10:56:43', '2025-07-21 10:56:43', NULL, 125, 2),
(320, NULL, NULL, '2025-07-21 11:14:07', '2025-07-21 11:14:07', '2025-07-21 11:14:07', NULL, 125, 3),
(321, NULL, NULL, '2025-07-21 11:14:14', '2025-07-21 11:14:14', '2025-07-21 11:14:14', NULL, 125, 4),
(322, NULL, NULL, '2025-07-21 11:17:34', '2025-07-21 11:17:34', '2025-07-21 11:17:34', NULL, 125, 5),
(323, NULL, NULL, '2025-07-21 14:07:15', '2025-07-21 14:07:15', '2025-07-21 14:07:15', NULL, 110, 3),
(324, NULL, NULL, '2025-07-21 14:07:21', '2025-07-21 14:07:21', '2025-07-21 14:07:21', NULL, 110, 4),
(325, NULL, NULL, '2025-07-21 17:37:21', '2025-07-21 17:37:21', '2025-07-21 17:37:21', NULL, 126, 1),
(326, NULL, NULL, '2025-07-21 17:37:21', '2025-07-21 17:37:21', '2025-07-21 17:37:21', NULL, 126, 2),
(327, NULL, NULL, '2025-07-22 04:47:58', '2025-07-22 04:47:58', '2025-07-22 04:47:58', NULL, 127, 1),
(328, NULL, NULL, '2025-07-22 04:47:58', '2025-07-22 04:47:58', '2025-07-22 04:47:58', NULL, 127, 2),
(329, NULL, NULL, '2025-07-22 05:58:01', '2025-07-22 05:58:01', '2025-07-22 05:58:01', NULL, 128, 1),
(330, NULL, NULL, '2025-07-22 05:58:01', '2025-07-22 05:58:01', '2025-07-22 05:58:01', NULL, 128, 2),
(331, NULL, NULL, '2025-07-22 06:25:08', '2025-07-22 06:25:08', '2025-07-22 06:25:08', NULL, 129, 1),
(332, NULL, NULL, '2025-07-22 06:25:08', '2025-07-22 06:25:08', '2025-07-22 06:25:08', NULL, 129, 2),
(333, NULL, NULL, '2025-07-22 06:27:16', '2025-07-22 06:27:16', '2025-07-22 06:27:16', NULL, 130, 1),
(334, NULL, NULL, '2025-07-22 06:27:16', '2025-07-22 06:27:16', '2025-07-22 06:27:16', NULL, 130, 2),
(335, NULL, NULL, '2025-07-22 06:34:02', '2025-07-22 06:34:02', '2025-07-22 06:34:02', NULL, 131, 1),
(336, NULL, NULL, '2025-07-22 06:34:02', '2025-07-22 06:34:02', '2025-07-22 06:34:02', NULL, 131, 2);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `totalBill` decimal(20,2) DEFAULT 0.00,
  `subTotal` decimal(20,2) DEFAULT 0.00,
  `discountPrice` decimal(20,2) DEFAULT 0.00,
  `discountPercentage` int(11) DEFAULT 0,
  `itemsPrice` decimal(20,2) DEFAULT 0.00,
  `vat` decimal(20,2) DEFAULT 0.00,
  `totalWeight` decimal(10,2) DEFAULT 1.00,
  `note` text DEFAULT NULL,
  `paymentMethod` varchar(255) DEFAULT NULL,
  `poNumber` varchar(255) DEFAULT NULL,
  `paymentMethodId` varchar(255) DEFAULT NULL,
  `paymentIntentId` varchar(255) DEFAULT NULL,
  `paymentStatus` enum('pending','done') DEFAULT 'pending',
  `orderStatus` varchar(255) DEFAULT NULL,
  `trackingNumber` varchar(255) DEFAULT NULL,
  `shippingCompany` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `frequency` enum('just-onces','weekly','every-two-weeks','every-four-weeks') DEFAULT 'just-onces',
  `on` date DEFAULT NULL,
  `createdBy` enum('customer','sales-rep','admin') NOT NULL DEFAULT 'customer',
  `invoiceId` varchar(255) DEFAULT NULL,
  `hostedInvoiceUrl` text DEFAULT NULL,
  `invoicePdf` text DEFAULT NULL,
  `localPatnerCommission` decimal(20,2) DEFAULT 0.00,
  `adminReceivableAmount` decimal(20,2) DEFAULT NULL,
  `adminReceivableStatus` tinyint(1) DEFAULT 0,
  `shippingCharges` decimal(20,2) DEFAULT 0.00,
  `shippedBy` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `addressId` int(11) DEFAULT NULL,
  `orderFrequencyId` int(11) DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL,
  `statusId` int(11) DEFAULT NULL,
  `supplierId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `billingAddress` varchar(255) DEFAULT NULL,
  `grossPartnerAmount` varchar(255) DEFAULT NULL,
  `proportionalStripeFee` varchar(255) DEFAULT NULL,
  `invoiceNumber` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `totalBill`, `subTotal`, `discountPrice`, `discountPercentage`, `itemsPrice`, `vat`, `totalWeight`, `note`, `paymentMethod`, `poNumber`, `paymentMethodId`, `paymentIntentId`, `paymentStatus`, `orderStatus`, `trackingNumber`, `shippingCompany`, `deleted`, `frequency`, `on`, `createdBy`, `invoiceId`, `hostedInvoiceUrl`, `invoicePdf`, `localPatnerCommission`, `adminReceivableAmount`, `adminReceivableStatus`, `shippingCharges`, `shippedBy`, `createdAt`, `updatedAt`, `deletedAt`, `addressId`, `orderFrequencyId`, `salesRepId`, `statusId`, `supplierId`, `userId`, `billingAddress`, `grossPartnerAmount`, `proportionalStripeFee`, `invoiceNumber`) VALUES
(2, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 1.00, '', 'cheque', '12207', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-03', 'sales-rep', 'cs_live_b1nZS7zLBbVDdaKRsjM1RH9zqIt1GVSpWRv21D2itKwko8zCVlnTqUQpjw', 'https://checkout.stripe.com/c/pay/cs_live_b1nZS7zLBbVDdaKRsjM1RH9zqIt1GVSpWRv21D2itKwko8zCVlnTqUQpjw#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-03 14:14:25', '2025-07-14 12:00:24', NULL, 342, NULL, 5, 6, 9, 186, NULL, NULL, NULL, NULL),
(3, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, 'helloo', 'cod', '', NULL, NULL, 'pending', NULL, '26789', 'fedex', 0, 'just-onces', '2025-07-03', 'sales-rep', 'in_1RgoA0ECVLSM4sc2CTGS9ezw', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzJFZjBHYXVSYldqekIxMnEyYWhGSURUY1BJUTQyLDE0MjA5Mzg1MA0200FW91oGVv?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzJFZjBHYXVSYldqekIxMnEyYWhGSURUY1BJUTQyLDE0MjA5Mzg1MA0200FW91oGVv/pdf?s=ap', 0.00, NULL, 0, 30.04, NULL, '2025-07-03 14:30:47', '2025-07-17 23:23:49', NULL, 341, NULL, 5, 5, 4, 185, NULL, NULL, NULL, NULL),
(4, 710.92, 630.00, 0.00, 0, 630.00, 0.00, 72.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-03', 'sales-rep', 'in_1Rgon7ECVLSM4sc2ylUyHCNK', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzJzRW10MXF3QjFLVXRibHl1ZXN3U3pOdlIxQ29LLDE0MjA5NjI3NQ0200iUjpPlkd?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzJzRW10MXF3QjFLVXRibHl1ZXN3U3pOdlIxQ29LLDE0MjA5NjI3NQ0200iUjpPlkd/pdf?s=ap', 0.00, NULL, 0, 80.92, NULL, '2025-07-03 15:11:11', '2025-07-03 15:11:15', NULL, 341, 4, 5, 1, NULL, 185, NULL, NULL, NULL, NULL),
(5, 650.16, 597.00, 0.00, 0, 597.00, 0.00, 36.00, '', 'cod', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-03', 'customer', 'cs_live_b1ZMR7ouqCKfWFANwU6pTlIqsLKdgGHkLc6t1oNElyoBYXgBTX9u7Yxy05', 'https://checkout.stripe.com/c/pay/cs_live_b1ZMR7ouqCKfWFANwU6pTlIqsLKdgGHkLc6t1oNElyoBYXgBTX9u7Yxy05#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 53.16, NULL, '2025-07-03 15:47:31', '2025-07-08 06:16:54', NULL, 345, NULL, 5, 1, NULL, 191, NULL, NULL, NULL, NULL),
(6, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 2.00, '', 'card', '1234', NULL, NULL, 'done', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-03', 'sales-rep', 'in_1RgpvJECVLSM4sc2didN5cGw', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzQzeW1OaTZDUllLbXVxbGZEQXJQNWg2eXNkbTZlLDE0MjEwMDYyNw0200ewBeIDL1?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzQzeW1OaTZDUllLbXVxbGZEQXJQNWg2eXNkbTZlLDE0MjEwMDYyNw0200ewBeIDL1/pdf?s=ap', 0.00, NULL, 0, 20.00, NULL, '2025-07-03 16:23:44', '2025-07-03 16:37:44', NULL, 346, NULL, 5, 5, 1, 195, NULL, NULL, NULL, NULL),
(7, 29.00, 9.00, 0.00, 0, 9.00, 0.00, 9.00, '', 'card', '123456', NULL, NULL, 'done', NULL, '12354667', 'fedex', 0, 'just-onces', '2025-07-03', 'sales-rep', 'in_1RgqDWECVLSM4sc2haRVW7cf', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzRNWFlMY1F0dUphVHl1VFFWZEE5ZDN0azNUaUJULDE0MjEwMTc1Ng0200M3vf591w?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzRNWFlMY1F0dUphVHl1VFFWZEE5ZDN0azNUaUJULDE0MjEwMTc1Ng0200M3vf591w/pdf?s=ap', 0.00, NULL, 0, 20.00, NULL, '2025-07-03 16:42:33', '2025-07-14 12:10:05', NULL, 346, NULL, 5, 5, 1, 195, NULL, NULL, NULL, NULL),
(8, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 2.00, '', 'cheque', '', NULL, NULL, 'done', NULL, 'Tx2123123123', 'fedex', 0, 'just-onces', '2025-07-03', 'sales-rep', 'in_1RgqS2ECVLSM4sc2aVP8T2Ne', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzRiNUR0MkJFaFhnNFNCSXV2MzNxZnRNWG1zZ3NwLDE0MjEwMjY1Ng0200OH3TcaqN?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TYzRiNUR0MkJFaFhnNFNCSXV2MzNxZnRNWG1zZ3NwLDE0MjEwMjY1Ng0200OH3TcaqN/pdf?s=ap', 0.00, NULL, 0, 20.00, NULL, '2025-07-03 16:57:33', '2025-07-04 07:46:03', NULL, 346, NULL, 5, 4, 1, 195, NULL, NULL, NULL, NULL),
(9, 82.38, 29.22, 0.00, 0, 29.22, 0.00, 36.00, '', 'cod', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-03', 'customer', 'cs_live_b1IknGh3JlhYYBvvrV5JkhPWJ0key2Yzc9NhsFMeQ8mf8c3pHj7BhlgQko', 'https://checkout.stripe.com/c/pay/cs_live_b1IknGh3JlhYYBvvrV5JkhPWJ0key2Yzc9NhsFMeQ8mf8c3pHj7BhlgQko#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 53.16, NULL, '2025-07-04 06:30:35', '2025-07-16 05:18:29', NULL, 341, NULL, 5, 5, NULL, 185, NULL, NULL, '2.6890199999999997', NULL),
(10, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', NULL, NULL, 'done', NULL, 'q324354657', 'fedex', 0, 'just-onces', '2025-07-04', 'sales-rep', 'in_1Rh515ECVLSM4sc2jY0GeUcC', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY0plWkhYQVppbUlTRkIxS281em56YkdqcjlCcmQ3LDE0MjE1ODk4MA02005wGlg2P2?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY0plWkhYQVppbUlTRkIxS281em56YkdqcjlCcmQ3LDE0MjE1ODk4MA02005wGlg2P2/pdf?s=ap', 0.00, NULL, 1, 1.00, NULL, '2025-07-04 08:30:42', '2025-07-04 14:32:29', NULL, 347, NULL, 5, 4, 1, 196, NULL, NULL, NULL, NULL),
(11, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', 'pm_1Rh6ZmECVLSM4sc2QjsOStfH', 'pi_3Rh6YtECVLSM4sc20rXAkcTl', 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 1.00, NULL, '2025-07-04 10:10:42', '2025-07-04 10:10:42', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(12, 82.38, 29.22, 0.00, 0, 29.22, 0.00, 36.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-04 13:54:05', '2025-07-04 13:54:05', NULL, 348, NULL, NULL, 1, NULL, 197, NULL, NULL, NULL, NULL),
(13, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', 'in_1RhBG4ECVLSM4sc2vNGEIHRf', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY1E2ZnhFQTJtWm5lbElVQTdPS09lZFJ5UHBjZlRCLDE0MjE4MjYzOA02005Jk2Aacs?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY1E2ZnhFQTJtWm5lbElVQTdPS09lZFJ5UHBjZlRCLDE0MjE4MjYzOA02005Jk2Aacs/pdf?s=ap', 0.00, NULL, 0, 1.00, NULL, '2025-07-04 15:06:45', '2025-07-04 15:10:38', NULL, 348, NULL, 5, 1, NULL, 197, NULL, NULL, NULL, NULL),
(14, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 2.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'sales-rep', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-04 15:19:58', '2025-07-04 15:19:58', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(15, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', 'in_1RhBZYECVLSM4sc2eEABnc91', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY1FRSVJQSmxXQmFIZVljSjlmN3k0OVhsbXp0SGJvLDE0MjE4Mzg0Ng0200WeUVnQ3w?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TY1FRSVJQSmxXQmFIZVljSjlmN3k0OVhsbXp0SGJvLDE0MjE4Mzg0Ng0200WeUVnQ3w/pdf?s=ap', 0.00, NULL, 0, 1.00, NULL, '2025-07-04 15:22:59', '2025-07-04 15:30:46', NULL, 348, NULL, 5, 1, NULL, 197, NULL, NULL, NULL, NULL),
(16, 282.78, 219.48, 0.00, 0, 219.48, 0.00, 48.00, '', 'cheque', '1234', NULL, NULL, 'pending', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-04', 'sales-rep', 'in_1RhyGbECVLSM4sc2re07ehw6', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TZEVrNzF3UkJCWnJLZnhCcVlNU3NCTFpaeHlqV3B3LDE0MjM3MTA2Mg0200NGL578Ll?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TZEVrNzF3UkJCWnJLZnhCcVlNU3NCTFpaeHlqV3B3LDE0MjM3MTA2Mg0200NGL578Ll/pdf?s=ap', 0.00, NULL, 0, 63.30, NULL, '2025-07-06 19:30:23', '2025-07-06 19:31:33', NULL, 342, NULL, 5, 4, 1, 186, NULL, NULL, NULL, NULL),
(17, 725.63, 683.00, 0.00, 0, 683.00, 0.00, 48.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 42.63, NULL, '2025-07-07 06:16:59', '2025-07-07 06:16:59', NULL, 341, NULL, 5, 1, NULL, 185, NULL, NULL, NULL, NULL),
(18, 69.04, 39.00, 0.00, 0, 39.00, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-07 06:26:22', '2025-07-07 06:26:22', NULL, 348, NULL, 5, 1, NULL, 197, NULL, NULL, NULL, NULL),
(19, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-04', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 1.00, NULL, '2025-07-07 06:28:54', '2025-07-07 06:28:54', NULL, 188, NULL, NULL, 1, NULL, 53, NULL, NULL, NULL, NULL),
(20, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-07 06:44:12', '2025-07-07 06:44:12', NULL, 341, NULL, 5, 1, NULL, 185, NULL, NULL, NULL, NULL),
(21, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, 'supplier note hai ', 'cheque', 'PO0900', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-07 07:22:45', '2025-07-07 07:22:45', NULL, 341, NULL, 5, 1, NULL, 185, NULL, NULL, NULL, NULL),
(22, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-07 07:46:47', '2025-07-07 07:46:47', NULL, 341, NULL, 5, 1, NULL, 185, NULL, NULL, NULL, NULL),
(23, 69.04, 39.00, 0.00, 0, 39.00, 0.00, 12.00, 'yess', 'cheque', 'yess to chai', NULL, NULL, 'pending', NULL, '876543456789TO', 'fedex', 0, 'weekly', '2025-07-07', 'customer', 'in_1RiBrJECVLSM4sc2AErTUqrT', 'https://invoice.stripe.com/i/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TZFNtbGJjaW1nNkFGRFU2NEpsSGhBWFlUTEhKSWxkLDE0MjQyMzI3NQ0200x8im1sUV?s=ap', 'https://pay.stripe.com/invoice/acct_1HGqhQECVLSM4sc2/live_YWNjdF8xSEdxaFFFQ1ZMU000c2MyLF9TZFNtbGJjaW1nNkFGRFU2NEpsSGhBWFlUTEhKSWxkLDE0MjQyMzI3NQ0200x8im1sUV/pdf?s=ap', 0.00, NULL, 0, 30.04, NULL, '2025-07-07 09:40:48', '2025-07-07 10:09:59', NULL, 351, NULL, NULL, 5, 3, 198, NULL, NULL, NULL, NULL),
(24, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1ya9HEavcmDd3lvzy8nYa4KTTHZndS6vmLujSVfE39QlfSmWndfYcKVgQ', 'https://checkout.stripe.com/c/pay/cs_live_b1ya9HEavcmDd3lvzy8nYa4KTTHZndS6vmLujSVfE39QlfSmWndfYcKVgQ#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-07 13:21:55', '2025-07-07 13:38:27', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(25, 5530.04, 5500.00, 0.00, 0, 5500.00, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-07 13:39:19', '2025-07-07 13:39:19', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(26, 503.30, 0.00, 0.00, 0, 440.00, 0.00, 48.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'sales-rep', NULL, NULL, '', 0.00, NULL, 0, 63.30, NULL, '2025-07-07 13:42:24', '2025-07-10 14:50:55', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(27, 383.16, 330.00, 0.00, 0, 330.00, 0.00, 36.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1VhEBxugdHbvHb24QZuV3IThGSJWO6vLW4LNyzBshRf90ePBf5T7u3edP', 'https://checkout.stripe.com/c/pay/cs_live_b1VhEBxugdHbvHb24QZuV3IThGSJWO6vLW4LNyzBshRf90ePBf5T7u3edP#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 53.16, NULL, '2025-07-07 13:42:24', '2025-07-07 13:46:57', NULL, 342, NULL, 5, 4, 2, 186, NULL, NULL, NULL, NULL),
(28, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', 'pm_1RiFNMECVLSM4sc2kXxmb6YJ', 'pi_3RiFJ0ECVLSM4sc20Ruwdstn', 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'customer', NULL, NULL, NULL, 1.00, 2.00, 1, 1.00, NULL, '2025-07-07 13:46:36', '2025-07-07 13:46:36', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(29, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1J82e17qJqFRgz9LxxIl30ODlRnbKzDqDKgdlNCC6dxa1Y2qXUVajdjZM', 'https://checkout.stripe.com/c/pay/cs_live_b1J82e17qJqFRgz9LxxIl30ODlRnbKzDqDKgdlNCC6dxa1Y2qXUVajdjZM#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-07 13:48:16', '2025-07-07 13:49:56', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(30, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '12345', 'pm_1RiGFYECVLSM4sc2H0RPcbHm', 'pi_3RiGCJECVLSM4sc21ZxTouZo', 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, 3.00, 0, 1.00, NULL, '2025-07-07 14:42:37', '2025-07-07 14:42:37', NULL, 188, NULL, NULL, 1, NULL, 53, NULL, NULL, NULL, NULL),
(31, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'done', NULL, 'sdfrtr', 'fedex', 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1Pr8OoRJ8u37fceeUiubAtxyRtKEjBeftOq917rQsPbsjuUZDJqCYUI5e', 'https://checkout.stripe.com/c/pay/cs_live_b1Pr8OoRJ8u37fceeUiubAtxyRtKEjBeftOq917rQsPbsjuUZDJqCYUI5e#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 1.00, 2.00, 1, 1.00, NULL, '2025-07-07 14:53:44', '2025-07-09 14:34:22', NULL, 347, NULL, 5, 4, 8, 196, NULL, NULL, NULL, NULL),
(32, 165.94, 135.90, 0.00, 0, 135.90, 0.00, 12.00, '', 'card', '', NULL, NULL, 'done', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1wuLEoP1eyolGmaymViT749Fr8CjRKP1t62dByLAyVm90MJIvF4d3ZCeE', 'https://checkout.stripe.com/c/pay/cs_live_b1wuLEoP1eyolGmaymViT749Fr8CjRKP1t62dByLAyVm90MJIvF4d3ZCeE#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-07 17:21:45', '2025-07-07 17:32:04', NULL, 353, NULL, 10, 5, 9, 199, NULL, NULL, NULL, NULL),
(33, 129.04, 99.00, 0.00, 0, 99.00, 0.00, 12.00, '', 'cheque', 'qwe', NULL, NULL, 'done', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-07', 'sales-rep', 'cs_live_b1Vkj4QK6eImgtApQ120xRiFZrLy4avxIEIsr74E9q4Z6C8APsLINcZ76x', 'https://checkout.stripe.com/c/pay/cs_live_b1Vkj4QK6eImgtApQ120xRiFZrLy4avxIEIsr74E9q4Z6C8APsLINcZ76x#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-07 17:47:11', '2025-07-07 17:55:16', NULL, 353, NULL, 10, 5, 9, 199, NULL, NULL, NULL, NULL),
(34, 69.04, 39.00, 0.00, 0, 39.00, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-08 04:31:28', '2025-07-08 06:16:28', NULL, 354, NULL, NULL, 6, NULL, 198, NULL, NULL, NULL, NULL),
(35, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '090078601', 'fedex', 0, 'just-onces', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-08 04:33:50', '2025-07-08 04:43:45', NULL, 354, NULL, NULL, 5, 3, 198, NULL, NULL, NULL, NULL),
(36, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-07', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-08 06:22:19', '2025-07-08 06:25:00', NULL, 354, NULL, NULL, 6, NULL, 198, NULL, NULL, NULL, NULL),
(37, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, 'supplier note for testing', 'cheque', 'PO456789', NULL, NULL, 'pending', NULL, '876543', 'fedex', 0, 'weekly', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-08 12:33:50', '2025-07-09 05:37:24', NULL, 354, NULL, NULL, 5, 3, 198, NULL, NULL, NULL, NULL),
(38, 262.63, 220.00, 0.00, 0, 220.00, 0.00, 24.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-08', 'sales-rep', 'cs_live_b1MdRmzp5gxZgFRqoB30zuGf5kiVtoSd63nJnejlKxphzU3kx3cJdeQ7Hh', 'https://checkout.stripe.com/c/pay/cs_live_b1MdRmzp5gxZgFRqoB30zuGf5kiVtoSd63nJnejlKxphzU3kx3cJdeQ7Hh#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 42.63, NULL, '2025-07-08 14:11:44', '2025-07-08 14:13:41', NULL, 353, NULL, 10, 5, 9, 199, NULL, NULL, NULL, NULL),
(39, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 2.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-09 05:57:19', '2025-07-09 06:26:27', NULL, 354, NULL, NULL, 6, 3, 198, NULL, NULL, NULL, NULL),
(40, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 2.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-09 07:43:10', '2025-07-09 07:43:10', NULL, 354, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(41, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 4.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-09 10:06:24', '2025-07-09 10:06:24', NULL, 354, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(42, 62.11, 19.48, 0.00, 0, 19.48, 0.00, 24.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 42.63, NULL, '2025-07-09 10:08:19', '2025-07-09 10:08:19', NULL, 354, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(43, 40.78, 10.74, 0.00, 0, 10.74, 0.00, 14.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-08', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-09 10:09:54', '2025-07-09 10:09:54', NULL, 354, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(44, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-09', 'customer', 'cs_live_b1P41LD6NrTwNc31VrlyaQ7i3zaWPv4CFyPXvMJbtwskSEY95iYgWeJUzc', 'https://checkout.stripe.com/c/pay/cs_live_b1P41LD6NrTwNc31VrlyaQ7i3zaWPv4CFyPXvMJbtwskSEY95iYgWeJUzc#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-09 14:13:46', '2025-07-09 14:19:08', NULL, 188, NULL, NULL, 1, NULL, 53, NULL, NULL, NULL, NULL),
(45, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'card', '', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-09', 'customer', 'cs_live_b1179C2aOJE84JHA6vmE2LbygfG58O1TtYR9Tda4AqEPZcBaz0mN8dX2j6', 'https://checkout.stripe.com/c/pay/cs_live_b1179C2aOJE84JHA6vmE2LbygfG58O1TtYR9Tda4AqEPZcBaz0mN8dX2j6#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-09 14:23:16', '2025-07-11 11:25:52', NULL, 342, NULL, 5, 3, 3, 186, NULL, NULL, NULL, NULL),
(46, 1.00, 0.00, 0.00, 0, 1.00, 0.00, 4000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-10', 'sales-rep', NULL, NULL, '', 0.00, NULL, 0, 1.00, NULL, '2025-07-10 14:23:17', '2025-07-10 14:52:47', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, '0.387', NULL),
(47, 4901.00, 4901.00, 0.00, 0, 4901.00, 0.00, 4012.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '986543q', 'fedex', 0, 'weekly', '2025-07-11', 'customer', 'cs_live_b1ISb8g9fFBTYvzow0cbkVY9M8qGUMl0Rto7CTv2hNRrXr4cz6G6LFtdHd', 'https://checkout.stripe.com/c/pay/cs_live_b1ISb8g9fFBTYvzow0cbkVY9M8qGUMl0Rto7CTv2hNRrXr4cz6G6LFtdHd#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 0.00, NULL, '2025-07-11 05:27:12', '2025-07-11 05:44:38', NULL, 351, NULL, NULL, 5, 3, 198, NULL, NULL, '142.42900000000003', NULL),
(48, 5.00, 5.00, 0.00, 0, 5.00, 0.00, 20000.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-11', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 0.00, NULL, '2025-07-11 11:49:20', '2025-07-11 11:49:20', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(57, 582.84, 517.00, 0.00, 0, 517.00, 0.00, 60.00, '', NULL, 'PO575820000044006', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-11', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 65.84, NULL, '2025-07-11 12:58:25', '2025-07-11 13:16:14', NULL, 230, NULL, 5, 1, NULL, 95, NULL, NULL, NULL, NULL),
(58, 229.04, 199.00, 0.00, 0, 199.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-11', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-11 13:46:35', '2025-07-11 13:46:35', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(59, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-11', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 1.00, NULL, '2025-07-11 13:47:38', '2025-07-11 13:47:38', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(60, 891.26, 792.00, 0.00, 0, 792.00, 0.00, 96.00, '', NULL, '\nPO-212609-store room', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 99.26, NULL, '2025-07-14 05:37:20', '2025-07-14 05:37:20', NULL, 199, NULL, 5, 1, NULL, 64, NULL, NULL, NULL, NULL),
(61, 696.92, 616.00, 0.00, 0, 616.00, 0.00, 72.00, '', NULL, 'PO-575820000044006', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 80.92, NULL, '2025-07-14 05:48:41', '2025-07-14 05:48:41', NULL, 230, NULL, 5, 1, NULL, 95, NULL, NULL, NULL, NULL),
(62, 1474.96, 1359.00, 0.00, 0, 1359.00, 0.00, 120.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 115.96, NULL, '2025-07-14 06:30:59', '2025-07-14 06:30:59', NULL, 335, NULL, 5, 1, NULL, 179, NULL, NULL, NULL, NULL),
(63, 288.53, 245.90, 0.00, 0, 245.90, 0.00, 24.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 42.63, NULL, '2025-07-14 07:25:58', '2025-07-14 07:25:58', NULL, 146, NULL, 5, 1, NULL, 11, NULL, NULL, NULL, NULL),
(64, 165.94, 135.90, 0.00, 0, 135.90, 0.00, 12.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-14 07:51:11', '2025-07-14 07:51:11', NULL, 151, NULL, 5, 1, NULL, 16, NULL, NULL, NULL, NULL),
(65, 634.64, 568.80, 0.00, 0, 568.80, 0.00, 60.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 65.84, NULL, '2025-07-14 09:15:01', '2025-07-14 09:15:01', NULL, 204, NULL, 5, 1, NULL, 69, NULL, NULL, NULL, NULL),
(66, 387.06, 333.90, 0.00, 0, 333.90, 0.00, 36.00, '', NULL, 'PO- P&L A&G', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-14 09:25:09', '2025-07-14 09:25:09', NULL, 199, NULL, 5, 1, NULL, 64, NULL, NULL, NULL, NULL),
(67, 597.74, 531.90, 0.00, 0, 531.90, 0.00, 60.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 65.84, NULL, '2025-07-14 09:43:20', '2025-07-14 09:43:20', NULL, 203, NULL, 5, 1, NULL, 68, NULL, NULL, NULL, NULL),
(68, 387.06, 333.90, 0.00, 0, 333.90, 0.00, 36.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-14 10:01:07', '2025-07-14 10:01:07', NULL, 337, NULL, 5, 1, NULL, 181, NULL, NULL, NULL, NULL),
(70, 533.10, 469.80, 0.00, 0, 469.80, 0.00, 48.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 63.30, NULL, '2025-07-14 10:11:32', '2025-07-15 05:17:41', NULL, 166, NULL, 5, 3, 9, 31, NULL, NULL, NULL, NULL),
(71, 1474.96, 1359.00, 0.00, 0, 1359.00, 0.00, 120.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 115.96, NULL, '2025-07-14 10:15:38', '2025-07-14 10:15:38', NULL, 335, NULL, 5, 1, NULL, 179, NULL, NULL, NULL, NULL),
(72, 1071.86, 972.60, 0.00, 0, 972.60, 0.00, 96.00, '', NULL, 'PO- 575820000044146', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 99.26, NULL, '2025-07-14 10:23:21', '2025-07-14 10:23:21', NULL, 230, NULL, 5, 1, NULL, 95, NULL, NULL, NULL, NULL),
(73, 917.15, 825.70, 0.00, 0, 825.70, 0.00, 84.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-14', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 91.45, NULL, '2025-07-14 11:21:58', '2025-07-14 11:21:58', NULL, 355, NULL, 5, 1, NULL, 200, NULL, NULL, NULL, NULL),
(74, 22.00, 0.00, 0.00, 0, 2.00, 0.00, 4.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '12345', 'fedex', 0, 'just-onces', '2025-07-15', 'sales-rep', 'cs_live_b1nhrhfxplbH2xfNLoQwU61K0rZX4RbmHAOBduYcmdOUZwVMusTIzuAhvM', 'https://checkout.stripe.com/c/pay/cs_live_b1nhrhfxplbH2xfNLoQwU61K0rZX4RbmHAOBduYcmdOUZwVMusTIzuAhvM#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-15 01:52:47', '2025-07-15 02:09:11', NULL, 342, NULL, 5, 4, 9, 186, NULL, NULL, '0.938', NULL),
(75, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, 'notr for supplier', '', 'ponumber', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-15 04:28:25', '2025-07-15 04:28:25', NULL, 351, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(76, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 2.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-15 04:34:24', '2025-07-15 04:34:24', NULL, 351, NULL, NULL, 1, NULL, 198, NULL, NULL, NULL, NULL),
(77, 3630.04, 3600.00, 0.00, 0, 3600.00, 0.00, 12.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-15', 'sales-rep', 'cs_live_b1DllTSwJwBiSRzS5zIhB4YaW5uujpASaRDs0y2ceyFKtylrNSkC6cEThZ', 'https://checkout.stripe.com/c/pay/cs_live_b1DllTSwJwBiSRzS5zIhB4YaW5uujpASaRDs0y2ceyFKtylrNSkC6cEThZ#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-15 04:49:00', '2025-07-15 04:49:46', NULL, 347, 77, 5, 3, 9, 196, NULL, NULL, '105.57116', NULL),
(78, 24.00, 0.00, 0.00, 0, 4.00, 0.00, 8.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-15 06:10:41', '2025-07-15 16:31:15', NULL, 342, NULL, 5, 1, NULL, 186, NULL, NULL, NULL, NULL),
(79, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 4.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 20.00, NULL, '2025-07-15 11:28:46', '2025-07-15 11:28:46', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(80, 162.37, 119.74, 0.00, 0, 119.74, 0.00, 24.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 42.63, NULL, '2025-07-15 11:50:37', '2025-07-17 06:31:04', NULL, 351, NULL, NULL, 3, 4, 198, NULL, NULL, NULL, NULL),
(81, 403.04, 339.74, 0.00, 0, 339.74, 0.00, 48.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 63.30, NULL, '2025-07-15 12:57:02', '2025-07-17 05:09:29', NULL, 351, NULL, NULL, 3, 4, 198, NULL, NULL, NULL, NULL),
(82, 4.00, 3.00, 0.00, 0, 3.00, 0.00, 8002.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 1.00, NULL, '2025-07-15 13:00:26', '2025-07-15 13:00:26', NULL, 347, NULL, 5, 1, NULL, 196, NULL, NULL, NULL, NULL),
(83, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 1.00, NULL, '2025-07-15 13:35:57', '2025-07-16 09:19:21', NULL, 347, NULL, 5, 3, 9, 196, NULL, NULL, NULL, NULL),
(84, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 2.00, '', 'card', '', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-15', 'sales-rep', 'cs_live_b19dsqLmWwwgSOMd3AmcsnrSKhvbhFgdzpy1iPYbbRlriejP0UAYB7J1lB', 'https://checkout.stripe.com/c/pay/cs_live_b19dsqLmWwwgSOMd3AmcsnrSKhvbhFgdzpy1iPYbbRlriejP0UAYB7J1lB#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-15 13:46:49', '2025-07-16 01:58:25', NULL, 138, NULL, 5, 2, 9, 3, NULL, NULL, '0.909', NULL),
(85, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '419851264936', 'fedex', 0, 'just-onces', '2025-07-16', 'sales-rep', 'cs_live_b12ldPArygLMTR7rC4OlV0Z61lyJe04djtsxAsJlciODfCtLkVM6PK301L', 'https://checkout.stripe.com/c/pay/cs_live_b12ldPArygLMTR7rC4OlV0Z61lyJe04djtsxAsJlciODfCtLkVM6PK301L#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-15 21:35:19', '2025-07-15 21:51:33', NULL, 342, NULL, 5, 4, 9, 186, NULL, NULL, '0.387', NULL),
(86, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '123456', 'fedex', 0, 'just-onces', '2025-07-16', 'sales-rep', 'cs_live_b1fXWRYuw6e0WHSTLoJmZ69UbWTi8PypgbgLYpdSXbOZ3z1I1XLuVTc75X', 'https://checkout.stripe.com/c/pay/cs_live_b1fXWRYuw6e0WHSTLoJmZ69UbWTi8PypgbgLYpdSXbOZ3z1I1XLuVTc75X#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-15 22:12:27', '2025-07-15 22:16:09', NULL, 353, NULL, 10, 4, 9, 199, NULL, NULL, '0.387', NULL),
(87, 4930.04, 4900.00, 0.00, 0, 4900.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', 'cs_live_b12yrDk8QRZgfdyTXMAqa2YIuaY42VQDqrxA0ykRKZO5NCtlAeeflzQ0DW', 'https://checkout.stripe.com/c/pay/cs_live_b12yrDk8QRZgfdyTXMAqa2YIuaY42VQDqrxA0ykRKZO5NCtlAeeflzQ0DW#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-16 04:57:12', '2025-07-16 04:58:13', NULL, 351, NULL, NULL, 2, 9, 198, NULL, NULL, '143.27116', NULL),
(88, 4952.37, 4909.74, 0.00, 0, 4909.74, 0.00, 24.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-16', 'customer', 'cs_live_b1YLoPNAJFIBu0NTrNMIX0Mxg7B6dyb8YRd06zbONCr4nC6efkvZSOHAVH', 'https://checkout.stripe.com/c/pay/cs_live_b1YLoPNAJFIBu0NTrNMIX0Mxg7B6dyb8YRd06zbONCr4nC6efkvZSOHAVH#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 42.63, NULL, '2025-07-16 05:55:43', '2025-07-16 09:26:19', NULL, 351, NULL, NULL, 2, 9, 198, NULL, NULL, '143.91873', NULL),
(89, 748.72, 667.80, 0.00, 0, 667.80, 0.00, 72.00, '', NULL, 'P38K800018449', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 80.92, NULL, '2025-07-16 06:20:06', '2025-07-16 06:20:06', NULL, 356, NULL, 5, 2, 9, 201, NULL, NULL, NULL, NULL),
(90, 1370.63, 1236.60, 0.00, 0, 1236.60, 0.00, 132.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 134.03, NULL, '2025-07-16 06:43:15', '2025-07-16 06:43:15', NULL, 172, NULL, 5, 2, 9, 37, NULL, NULL, NULL, NULL),
(91, 1072.52, 964.80, 0.00, 0, 964.80, 0.00, 108.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 107.72, NULL, '2025-07-16 07:38:28', '2025-07-16 07:38:28', NULL, 357, NULL, 5, 2, 9, 202, NULL, NULL, NULL, NULL),
(92, 1608.47, 1434.60, 0.00, 0, 1434.60, 0.00, 156.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 173.87, NULL, '2025-07-16 07:54:22', '2025-07-16 07:54:22', NULL, 159, NULL, 5, 2, 9, 24, NULL, NULL, NULL, NULL),
(93, 2282.72, 1980.00, 0.00, 0, 1980.00, 0.00, 240.00, 'PO- 6486 - Concierge/ Club Lounge', NULL, '6486', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 302.72, NULL, '2025-07-16 10:05:14', '2025-07-16 10:05:14', NULL, 201, NULL, 5, 2, 9, 66, NULL, NULL, NULL, NULL),
(94, 2203.64, 1929.60, 0.00, 0, 1929.60, 0.00, 216.00, 'PO- 225245 - P&L Rooms Division ', NULL, '225245', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 274.04, NULL, '2025-07-16 10:28:38', '2025-07-16 10:28:38', NULL, 358, NULL, 5, 2, 9, 203, NULL, NULL, NULL, NULL),
(95, 496.20, 432.90, 0.00, 0, 432.90, 0.00, 48.00, '', NULL, '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 63.30, NULL, '2025-07-16 11:18:31', '2025-07-16 11:18:31', NULL, 359, NULL, 5, 2, 9, 204, NULL, NULL, NULL, NULL),
(96, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'sales-rep', 'cs_live_b1yA7K8hJVsMwOgD7zCMTw0o2VK1HY8aeCKCgHmEzEcF5wWvN9P2vNDSwY', 'https://checkout.stripe.com/c/pay/cs_live_b1yA7K8hJVsMwOgD7zCMTw0o2VK1HY8aeCKCgHmEzEcF5wWvN9P2vNDSwY#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-16 13:23:19', '2025-07-17 11:23:41', NULL, 353, NULL, 10, 3, 9, 199, NULL, NULL, '0.387', NULL),
(97, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 4.00, '', 'cheque', '12345', NULL, NULL, 'pending', NULL, '743781978739', 'fedex', 0, 'just-onces', '2025-07-16', 'sales-rep', 'cs_live_b11nIRnHsIEmrOwC9kTMaJ1NTc9uh4b1otY9WXOwqn0boxyyqsLtWl60LE', 'https://checkout.stripe.com/c/pay/cs_live_b11nIRnHsIEmrOwC9kTMaJ1NTc9uh4b1otY9WXOwqn0boxyyqsLtWl60LE#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-16 13:26:55', '2025-07-16 15:41:03', NULL, 353, NULL, 10, 4, 9, 199, NULL, NULL, '0.938', NULL),
(98, 24.00, 0.00, 0.00, 0, 4.00, 0.00, 8.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '12345', 'fedex', 0, 'just-onces', '2025-07-16', 'sales-rep', NULL, NULL, '', 0.00, NULL, 0, 20.00, NULL, '2025-07-16 13:27:08', '2025-07-17 23:23:04', NULL, 343, NULL, 5, 5, 9, 188, NULL, NULL, '0.909', NULL),
(99, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '1234', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-16', 'sales-rep', 'cs_live_b122jDNeO0nRqjVDJq1VvUxzVnf1rj15p4cJmOcSDfIXllepygBBoArtYs', 'https://checkout.stripe.com/c/pay/cs_live_b122jDNeO0nRqjVDJq1VvUxzVnf1rj15p4cJmOcSDfIXllepygBBoArtYs#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-16 16:28:25', '2025-07-17 06:39:26', NULL, 342, NULL, 5, 5, 9, 186, NULL, NULL, '0.387', NULL),
(100, 102.26, 0.00, 0.00, 0, 38.96, 0.00, 48.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 63.30, NULL, '2025-07-17 05:29:38', '2025-07-17 12:14:08', NULL, 351, NULL, NULL, 3, 9, 198, NULL, NULL, NULL, NULL),
(101, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, '456789', 'fedex', 0, 'just-onces', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 06:56:02', '2025-07-17 11:22:17', NULL, 351, NULL, NULL, 4, 9, 198, NULL, NULL, NULL, NULL),
(102, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, '23456789', 'fedex', 0, 'weekly', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 10:43:50', '2025-07-17 11:23:17', NULL, 351, NULL, NULL, 5, 9, 198, NULL, NULL, NULL, NULL),
(103, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 10:46:01', '2025-07-17 10:47:44', NULL, 351, NULL, NULL, 3, 9, 198, NULL, NULL, NULL, NULL),
(104, 130.04, 0.00, 0.00, 0, 100.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, '234567890', 'fedex', 0, 'weekly', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 11:01:57', '2025-07-17 11:14:48', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, NULL),
(105, 39.78, 9.74, 0.00, 0, 9.74, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, '34567890', 'fedex', 0, 'weekly', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 11:24:19', '2025-07-17 11:25:03', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, NULL),
(106, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, '', '', '', NULL, NULL, 'done', NULL, '2345678903', 'fedex', 0, 'just-onces', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 12:00:34', '2025-07-21 09:19:47', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, 'INV-00106'),
(107, 129.04, 0.00, 0.00, 0, 99.00, 0.00, 12.00, '', '', '2222', NULL, NULL, 'pending', NULL, '345679', 'fedex', 0, 'just-onces', '2025-07-17', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-17 12:17:17', '2025-07-17 12:58:19', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, '10722'),
(108, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 2.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-17', 'sales-rep', 'cs_live_b1KJRAPvivq4CP6vssmalXL9ZG4FXKfrX4tKABqoFRHtP3ipwr3Vl3bTdc', 'https://checkout.stripe.com/c/pay/cs_live_b1KJRAPvivq4CP6vssmalXL9ZG4FXKfrX4tKABqoFRHtP3ipwr3Vl3bTdc#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-17 13:45:00', '2025-07-17 13:45:00', NULL, 347, NULL, 5, 2, 9, 196, NULL, NULL, '0.909', 'INV-00108'),
(109, 21.00, 1.00, 0.00, 0, 1.00, 0.00, 4000.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-17', 'sales-rep', 'cs_live_b1yFKkoSeqyo78jtZzXXyZIwKq5M19rNGgWbg9HecCFT14tawgTsB2efp1', 'https://checkout.stripe.com/c/pay/cs_live_b1yFKkoSeqyo78jtZzXXyZIwKq5M19rNGgWbg9HecCFT14tawgTsB2efp1#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-17 13:48:04', '2025-07-17 13:48:05', NULL, 347, NULL, 5, 2, 9, 196, NULL, NULL, '0.909', 'INV-00109'),
(110, 22.00, 2.00, 0.00, 0, 2.00, 0.00, 4.00, '', 'cheque', '', NULL, NULL, 'pending', NULL, '55', 'fedex', 0, 'just-onces', '2025-07-17', 'sales-rep', 'cs_live_b1RdATx8uo1aSyUwd0YLquj06jFx9p9zs0945ZriZ3rN6SEfoZkpfV9Y7M', 'https://checkout.stripe.com/c/pay/cs_live_b1RdATx8uo1aSyUwd0YLquj06jFx9p9zs0945ZriZ3rN6SEfoZkpfV9Y7M#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 20.00, NULL, '2025-07-17 13:52:28', '2025-07-21 14:07:21', NULL, 347, NULL, 5, 4, 9, 196, NULL, NULL, '0.938', 'INV-00110'),
(111, 718.92, 638.00, 0.00, 0, 638.00, 0.00, 72.00, '', 'cheque', '12345678', NULL, NULL, 'pending', NULL, '123456', 'fedex', 0, 'just-onces', '2025-07-17', 'sales-rep', 'cs_live_b1cOiG1ezY2PWscrWOCl6yyRqWFXERXJV3QdJtVoaEzz6N5mdP6VsVR7oz', 'https://checkout.stripe.com/c/pay/cs_live_b1cOiG1ezY2PWscrWOCl6yyRqWFXERXJV3QdJtVoaEzz6N5mdP6VsVR7oz#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 80.92, NULL, '2025-07-17 15:13:22', '2025-07-17 15:14:56', NULL, 364, NULL, 10, 5, 9, 212, NULL, NULL, '21.14868', 'INV-00111'),
(112, 3.00, 2.00, 0.00, 0, 2.00, 0.00, 8000.00, '', 'cheque', '1234', NULL, NULL, 'pending', NULL, '122334', 'fedex', 0, 'just-onces', '2025-07-18', 'sales-rep', 'cs_live_b1M4yU5PSgku3HDi1dkQpzOoUCTejNU2bT4SN0Qa0k7M7U3G8WOPoiFzEz', 'https://checkout.stripe.com/c/pay/cs_live_b1M4yU5PSgku3HDi1dkQpzOoUCTejNU2bT4SN0Qa0k7M7U3G8WOPoiFzEz#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 1.00, NULL, '2025-07-17 20:41:42', '2025-07-17 20:43:15', NULL, 364, NULL, 10, 5, 9, 212, NULL, NULL, '0.387', 'INV-00112'),
(113, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-18', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-18 04:35:21', '2025-07-18 04:35:21', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, 'INV-00113'),
(114, 503.30, 0.00, 0.00, 0, 440.00, 0.00, 48.00, '', '', '', NULL, NULL, 'pending', NULL, '23456789', 'fedex', 0, 'weekly', '2025-07-18', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 63.30, NULL, '2025-07-18 05:35:53', '2025-07-18 06:35:58', NULL, 351, NULL, 5, 4, 9, 198, NULL, NULL, NULL, '114'),
(115, 99274.04, 0.00, 0.00, 0, 99000.00, 0.00, 216.00, 'dfghj', 'cheque', 'ponumber123', NULL, NULL, 'done', NULL, '56785849845', 'fedex', 0, 'weekly', '2025-07-18', 'sales-rep', NULL, NULL, '', 0.00, NULL, 0, 274.04, NULL, '2025-07-18 06:29:20', '2025-07-21 09:46:29', NULL, 351, 115, 5, 4, 9, 198, NULL, NULL, '1918.4548300000001', '115'),
(116, 40.78, 10.74, 0.00, 0, 10.74, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-18', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-18 08:04:34', '2025-07-18 10:31:08', NULL, 351, NULL, 5, 3, 9, 198, NULL, NULL, NULL, 'INV-00116'),
(117, 195.38, 0.00, 0.00, 0, 87.66, 0.00, 108.00, '', '', '', NULL, NULL, 'pending', NULL, '3456780', 'fedex', 0, 'just-onces', '2025-07-18', 'customer', 'cs_live_b1sEK16JpQHB1dGlNsvkzJzrT7NeyQGtdk7ryegR0yPUnb7PNGXVbFnur6', 'https://checkout.stripe.com/c/pay/cs_live_b1sEK16JpQHB1dGlNsvkzJzrT7NeyQGtdk7ryegR0yPUnb7PNGXVbFnur6#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 107.72, NULL, '2025-07-18 08:07:24', '2025-07-18 10:45:09', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, '5.96602', '117'),
(118, 262.63, 220.00, 0.00, 0, 220.00, 0.00, 24.00, '', 'cheque', '123', NULL, NULL, 'pending', NULL, '743781978739', 'fedex', 0, 'just-onces', '2025-07-18', 'sales-rep', 'cs_live_b1Hh8cTUqYP2JFKPHoaeexc5xNHxjRjKN2YDmrgLj2V4D6XGoiNaVw0WQB', 'https://checkout.stripe.com/c/pay/cs_live_b1Hh8cTUqYP2JFKPHoaeexc5xNHxjRjKN2YDmrgLj2V4D6XGoiNaVw0WQB#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 42.63, NULL, '2025-07-18 17:29:27', '2025-07-18 17:32:50', NULL, 364, NULL, 10, 4, 9, 212, NULL, NULL, '7.91627', 'INV-00118');
INSERT INTO `orders` (`id`, `totalBill`, `subTotal`, `discountPrice`, `discountPercentage`, `itemsPrice`, `vat`, `totalWeight`, `note`, `paymentMethod`, `poNumber`, `paymentMethodId`, `paymentIntentId`, `paymentStatus`, `orderStatus`, `trackingNumber`, `shippingCompany`, `deleted`, `frequency`, `on`, `createdBy`, `invoiceId`, `hostedInvoiceUrl`, `invoicePdf`, `localPatnerCommission`, `adminReceivableAmount`, `adminReceivableStatus`, `shippingCharges`, `shippedBy`, `createdAt`, `updatedAt`, `deletedAt`, `addressId`, `orderFrequencyId`, `salesRepId`, `statusId`, `supplierId`, `userId`, `billingAddress`, `grossPartnerAmount`, `proportionalStripeFee`, `invoiceNumber`) VALUES
(119, 312.16, 259.00, 0.00, 0, 259.00, 0.00, 36.00, '', 'cheque', '5678', NULL, NULL, 'pending', NULL, '12', 'fedex', 0, 'just-onces', '2025-07-18', 'sales-rep', 'cs_live_b1vllDlc8WZmM3poDbSmxRSAUxLHCA0YbyEmUC3MlrNh1zgF7qj8NxbJrA', 'https://checkout.stripe.com/c/pay/cs_live_b1vllDlc8WZmM3poDbSmxRSAUxLHCA0YbyEmUC3MlrNh1zgF7qj8NxbJrA#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 53.16, NULL, '2025-07-18 17:38:14', '2025-07-18 18:14:09', NULL, 366, NULL, 10, 5, 9, 220, NULL, NULL, '9.352640000000003', 'INV-00119'),
(120, 3630.04, 3600.00, 0.00, 0, 3600.00, 0.00, 12.00, '', 'cheque', '12207', NULL, NULL, 'pending', NULL, '1', 'fedex', 0, 'just-onces', '2025-07-19', 'sales-rep', 'cs_live_b110OKmlTlUSF67cEVwn0V4Up2pflWzsJ5WalqQ7wu1Re0UlbhTGK2RYel', 'https://checkout.stripe.com/c/pay/cs_live_b110OKmlTlUSF67cEVwn0V4Up2pflWzsJ5WalqQ7wu1Re0UlbhTGK2RYel#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-19 12:55:20', '2025-07-19 20:15:43', NULL, 346, NULL, 5, 4, 9, 195, NULL, NULL, '105.57116', 'INV-00120'),
(121, 615.84, 0.00, 0.00, 0, 550.00, 0.00, 60.00, 'add note for sup', '', 'po order ni. demo', NULL, NULL, 'pending', NULL, '234567890898', 'fedex', 0, 'weekly', '2025-07-21', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 65.84, NULL, '2025-07-21 05:51:17', '2025-07-21 10:09:15', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, 'INV-00121'),
(122, 140.04, 110.00, 0.00, 0, 110.00, 0.00, 12.00, '', '', '', NULL, NULL, 'pending', NULL, '123450-', 'fedex', 0, 'weekly', '2025-07-21', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-21 06:09:48', '2025-07-21 07:48:24', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, 'INV-00122'),
(123, 130.04, 100.00, 0.00, 0, 100.00, 0.00, 12.00, '', '', '', NULL, NULL, 'done', NULL, '234567890', 'fedex', 0, 'weekly', '2025-07-21', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 30.04, NULL, '2025-07-21 09:21:23', '2025-07-21 09:57:25', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, NULL, 'INV-00123'),
(124, 353.16, 0.00, 0.00, 0, 300.00, 0.00, 36.00, '', '', '', NULL, NULL, 'pending', NULL, '000000000000000000000000', 'fedex', 0, 'weekly', '2025-07-21', 'customer', NULL, NULL, '', 0.00, NULL, 0, 53.16, NULL, '2025-07-21 09:40:54', '2025-07-21 10:08:19', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, '10.541640000000003', '124'),
(125, 262.63, 0.00, 0.00, 0, 220.00, 0.00, 24.00, 'comment', '', 'po0909', NULL, NULL, 'pending', NULL, '34567890', 'fedex', 0, 'weekly', '2025-07-21', 'customer', NULL, NULL, '', 0.00, NULL, 0, 42.63, NULL, '2025-07-21 10:56:43', '2025-07-21 14:42:47', NULL, 351, NULL, 5, 5, 9, 198, NULL, NULL, '7.91627', '1254'),
(126, 165.94, 135.90, 0.00, 0, 135.90, 0.00, 12.00, '', 'card', '345', NULL, NULL, 'done', NULL, NULL, NULL, 0, 'just-onces', '2025-07-21', 'sales-rep', 'cs_live_b1rd8xYiuew5znvJShoPSP8Lv0bNjHlr5NJsHHRcCnI5GsLuxC7YOG9ryX', 'https://checkout.stripe.com/c/pay/cs_live_b1rd8xYiuew5znvJShoPSP8Lv0bNjHlr5NJsHHRcCnI5GsLuxC7YOG9ryX#fidkdWxOYHwnPyd1blppbHNgWjA0TUJ0bVRARlNJVkgxdmY3cmc0YjFhfTZpUGAzNFNmTjZHSG9rUFVuNz1cMHRkV0Y8dkFUM10zRHcwSl9NaFNqRExTYDd3XWtmU0p9TVBkfTQ1dGcxYT1JNTVORkRhXXVhMCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl', '', 0.00, NULL, 0, 30.04, NULL, '2025-07-21 17:37:21', '2025-07-21 17:43:28', NULL, 367, NULL, 10, 2, 9, 225, NULL, NULL, '5.11226', 'INV-00126'),
(127, 62.11, 0.00, 0.00, 0, 19.48, 0.00, 24.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-22', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 42.63, NULL, '2025-07-22 04:47:58', '2025-07-22 05:13:19', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, '127'),
(128, 740.92, 0.00, 0.00, 0, 660.00, 0.00, 72.00, 'cgv', '', '5666', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'weekly', '2025-07-22', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 80.92, NULL, '2025-07-22 05:58:01', '2025-07-22 06:18:36', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, '128'),
(129, 383.16, 330.00, 0.00, 0, 330.00, 0.00, 36.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-22', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-22 06:25:08', '2025-07-22 06:25:08', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, 'INV-00129'),
(130, 383.16, 330.00, 0.00, 0, 330.00, 0.00, 36.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-22', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-22 06:27:16', '2025-07-22 06:27:16', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, 'INV-00130'),
(131, 383.16, 330.00, 0.00, 0, 330.00, 0.00, 36.00, '', '', '', NULL, NULL, 'pending', NULL, NULL, NULL, 0, 'just-onces', '2025-07-22', 'customer', NULL, NULL, NULL, 0.00, NULL, 0, 53.16, NULL, '2025-07-22 06:34:02', '2025-07-22 06:34:02', NULL, 351, NULL, 5, 2, 9, 198, NULL, NULL, NULL, 'INV-00131');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` varchar(255) NOT NULL,
  `weight` decimal(20,2) DEFAULT 0.00,
  `unit` varchar(255) NOT NULL,
  `image` varchar(255) NOT NULL,
  `price` decimal(20,2) DEFAULT 0.00,
  `wholesalePrice` decimal(20,2) DEFAULT 0.00,
  `desc` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `status` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `categoryId` int(11) DEFAULT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `productCode` varchar(255) DEFAULT NULL,
  `grind` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `quantity`, `weight`, `unit`, `image`, `price`, `wholesalePrice`, `desc`, `deleted`, `status`, `createdAt`, `updatedAt`, `deletedAt`, `categoryId`, `sku`, `productCode`, `grind`) VALUES
(1, 'Brazilian Terra Noble (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751452564872.png', 199.00, 140.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:36:05', NULL, 1, '20024-PRG', '20024', NULL),
(2, 'Colombian El Dorado Estate (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751452524334.png', 199.00, 140.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:35:24', NULL, 1, '20025-PRG', '20025', NULL),
(3, 'Colombian Supreme (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751452620067.png', 135.90, 105.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:37:00', NULL, 1, '20002-PRG', '20002', NULL),
(4, 'Decaf', '1000', 12.00, 'pounds', 'public/products/product-1751452139248.png', 139.00, 105.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:29:00', NULL, 1, '20026-PRG', '20026', NULL),
(5, 'French Roast (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751453061213.png', 135.90, 105.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:44:21', NULL, 1, '20003-PRG', '20003', NULL),
(6, 'Italian Espresso (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751448574003.png', 135.90, 105.00, ' ', 0, 1, '2025-07-01 15:13:30', '2025-07-02 09:29:34', NULL, 1, '20001-PRG', '20001', NULL),
(7, 'Colombian Supreme (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751452756204.png', 135.90, 105.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:39:22', NULL, 6, '20002-WB', '20002', NULL),
(8, 'Decaf', '1000', 12.00, 'pounds', 'public/products/product-1751452722954.png', 139.00, 105.00, '.', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:38:43', NULL, 6, '20026-WB', '20026', NULL),
(9, 'French Roast (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751452684148.png', 135.90, 105.00, '..', 0, 1, '2025-07-01 15:13:30', '2025-07-02 10:38:05', NULL, 6, '20003-WB', '20003', NULL),
(10, 'Italian Espresso (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751448531730.png', 135.90, 105.00, '  ', 0, 1, '2025-07-01 15:18:35', '2025-07-02 09:28:52', NULL, 6, '20001-WB', '20001', NULL),
(11, 'Brazilian Terra Noble (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751451983471.png', 199.00, 140.00, '.', 0, 1, '2025-07-01 15:18:35', '2025-07-02 10:26:23', NULL, 6, '20024-WB', '20024', NULL),
(12, 'Colombian El Dorado Estate (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751453321734.png', 199.00, 140.00, '.', 0, 1, '2025-07-01 15:18:35', '2025-07-02 10:48:42', NULL, 6, '20025-WB', '20025', NULL),
(13, 'Sumatra Obsidian Reserve (10 lbs per case)', '1000', 12.00, 'pounds', 'public/products/product-1751453380605.png', 199.00, 140.00, '.', 0, 1, '2025-07-01 15:18:35', '2025-07-02 10:49:41', NULL, 6, '20023-WB', '20023', NULL),
(14, '10 oz Hot Cup Lids (Case of 1000)', '1000', 12.00, 'lbs', '', 95.00, 71.25, NULL, 0, 1, '2025-07-01 15:18:35', '2025-07-01 15:18:35', NULL, 2, '50002', '50002', NULL),
(15, '10 oz Hot Cup Sleeves (Case of 1000)', '1000', 12.00, 'lbs', '', 95.00, 71.25, NULL, 0, 1, '2025-07-01 15:18:35', '2025-07-01 15:18:35', NULL, 2, '50003', '50003', NULL),
(16, '10 oz Hot Cups Cups  (Case of 1,000)', '1000', 12.00, 'pounds', 'public/products/product-1751453273271.jpeg', 99.00, 74.25, '.', 0, 1, '2025-07-01 15:18:35', '2025-07-02 10:47:53', NULL, 2, '50001', '50001', NULL),
(17, 'Stir Sticks (10 Boxes per case)', '1000', 12.00, 'lbs', '', 86.00, 64.50, NULL, 0, 1, '2025-07-01 15:18:35', '2025-07-01 15:18:35', NULL, 2, '50004', '50004', NULL),
(18, 'Brazilian Bold', '1000', 12.00, 'pounds', 'public/products/product-1751453144907.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:18:35', '2025-07-02 10:45:45', NULL, 5, '70007', '70007', NULL),
(19, 'Breakfast Blend', '1000', 12.00, 'pounds', 'public/products/product-1751453106779.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:45:07', NULL, 5, '70008', '70008', NULL),
(20, 'Colombian (low acid)', '1000', 12.00, 'pounds', 'public/products/product-1751452065732.png', 10.74, 4.83, '..', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:27:47', NULL, 5, '700013', '700013', NULL),
(21, 'Colombian Supreme', '1000', 12.00, 'pounds', 'public/products/product-1751452941553.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:42:26', NULL, 5, '70009', '70009', NULL),
(22, 'Donut Shop Blend', '1000', 12.00, 'pounds', 'public/products/product-1751452890727.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:41:31', NULL, 5, '700010', '700010', NULL),
(23, 'Espresso', '1000', 12.00, 'pounds', 'public/products/product-1751453905151.png', 9.74, 4.38, '..', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:58:26', NULL, 5, '700011', '700011', NULL),
(24, 'French Roast', '1000', 12.00, 'pounds', 'public/products/product-1751453010441.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:43:35', NULL, 5, '700012', '700012', NULL),
(25, 'Morning Light', '1000', 12.00, 'pounds', 'public/products/product-1751453852161.png', 9.74, 4.38, '..', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:57:33', NULL, 5, '700014', '700014', NULL),
(26, 'Extra Caffeine', '1000', 12.00, 'pounds', 'public/products/product-1751451753229.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:22:41', NULL, 5, '700028', '700028', NULL),
(27, 'Chocolate Peanut Butter Cup Cappuccino', '1000', 12.00, 'pounds', 'public/products/product-1751451713034.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:21:09', '2025-07-02 10:21:54', NULL, 5, '700020', '700020', NULL),
(28, 'Cinnamon Swirl', '1000', 12.00, 'pounds', 'public/products/product-1751451655268.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:20:56', NULL, 5, '700021', '700021', NULL),
(29, 'Cookies and Cream Cappuccino', '1000', 12.00, 'pounds', 'public/products/product-1751452847061.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:40:47', NULL, 5, '700022', '700022', NULL),
(30, 'FrenchVanilla Cappuccino', '1000', 12.00, 'pounds', 'public/products/product-1751453949335.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:59:13', NULL, 5, '700019', '700019', NULL),
(31, 'Mocha', '1000', 12.00, 'pounds', 'public/products/product-1751451499248.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:18:20', NULL, 5, '700023', '700023', NULL),
(32, 'Original Cappuccino', '1000', 12.00, 'pounds', 'public/products/product-1751451435638.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:17:16', NULL, 5, '700017', '700017', NULL),
(33, 'Pumpkin Spice Cappuccino', '1000', 12.00, 'pounds', 'public/products/product-1751451351993.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:15:53', NULL, 5, '700018', '700018', NULL),
(34, 'Cocoa Mint Hot Chocolate', '1000', 12.00, 'pounds', 'public/products/product-1751451299764.png', 10.74, 4.83, '..', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:15:01', NULL, 5, '700025', '700025', NULL),
(35, 'Hot Chocolate', '1000', 12.00, 'pounds', 'public/products/product-1751451179776.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:13:01', NULL, 5, '700024', '700024', NULL),
(36, 'Mocha Supreme Hot Chocolate', '1000', 12.00, 'pounds', 'public/products/product-1751451118249.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:22:18', '2025-07-02 10:11:59', NULL, 5, '700027', '700027', NULL),
(37, 'Brazilian Bold', '1000', 12.00, 'pounds', 'public/products/product-1751451023661.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:10:28', NULL, 5, '70002', '70002', NULL),
(38, 'Colombian (low acid)', '1000', 12.00, 'pounds', 'public/products/product-1751450983401.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:09:45', NULL, 5, '70006', '70006', NULL),
(39, 'Colombian Supreme', '1000', 12.00, 'pounds', 'public/products/product-1751450948030.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:09:09', NULL, 5, '70003', '70003', NULL),
(40, 'Donut Shop Blend', '1000', 12.00, 'pounds', 'public/products/product-1751450906035.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:08:27', NULL, 5, '70004', '70004', NULL),
(41, 'Espresso', '1000', 12.00, 'pounds', 'public/products/product-1751450857900.png', 10.74, 4.83, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:07:39', NULL, 5, '700015', '700015', NULL),
(42, 'French Roast', '1000', 12.00, 'pounds', 'public/products/product-1751450737648.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:05:38', NULL, 5, '700016', '700016', NULL),
(43, 'Morning Light', '1000', 12.00, 'pounds', 'public/products/product-1751450680617.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:04:41', NULL, 5, '70005', '70005', NULL),
(44, 'Breakfast Blend', '1000', 12.00, 'pounds', 'public/products/product-1751450635026.png', 9.74, 4.38, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:03:59', NULL, 5, '70001', '70001', NULL),
(45, 'Vanilla Chai Soluble Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450560040.jpg', 110.00, 49.50, '.', 0, 1, '2025-07-01 15:23:44', '2025-07-02 10:02:40', NULL, 4, '30009', '30009', NULL),
(46, 'Cappuccino Creamer', '1000', 12.00, 'pounds', 'public/products/product-1751450499247.jpg', 99.00, 44.55, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 10:01:40', NULL, 4, '30001', '30001', NULL),
(47, 'French Vanilla Cappuccino Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450432514.jpg', 99.00, 44.55, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 10:00:32', NULL, 4, '30004', '30004', NULL),
(48, 'Hot Chocolate Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450365059.jpg', 99.00, 44.55, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:59:25', NULL, 4, '30002', '30002', NULL),
(49, 'Peppermint Cappuccino Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450309431.jpg', 110.00, 49.50, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:58:30', NULL, 4, '30007', '30007', NULL),
(50, 'Pumpkin Spice Cappuccino Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450266760.jpg', 110.00, 49.50, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:57:47', NULL, 4, '30006', '30006', NULL),
(51, 'Soluble Coffee- 1 lb', '1000', 12.00, 'pounds', 'public/products/product-1751454107579.png', 100.00, 45.00, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 11:01:47', NULL, 4, '300010', '300010', NULL),
(52, 'Soluble Milk Powder', '1000', 12.00, 'pounds', 'public/products/product-1751449732780.jpg', 110.00, 49.50, 'Soluble Milk Powder', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:48:53', NULL, 4, '30008', '30008', NULL),
(53, 'Sugar-Free French Vanilla Cappuccino Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450119232.jpg', 110.00, 49.50, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:55:20', NULL, 4, '30005', '30005', NULL),
(54, 'Sugar-Free Hot Chocolate Powder', '1000', 12.00, 'pounds', 'public/products/product-1751450184622.jpg', 110.00, 49.50, '.', 0, 1, '2025-07-01 15:24:54', '2025-07-02 09:56:24', NULL, 4, '30003', '30003', NULL),
(55, 'Sugar Packet- Box of 2000', '1000', 12.00, 'pounds', 'public/products/product-1751449991712.png', 39.00, 23.00, '.', 0, 1, '2025-07-01 15:28:23', '2025-07-02 09:53:13', NULL, 2, '60001', '60001', NULL),
(56, 'SENSA Pro', '1000', 12.00, 'lbs', '', 7200.00, 4000.00, NULL, 0, 1, '2025-07-01 15:28:23', '2025-07-01 15:28:23', NULL, 3, '10001', '10001', NULL),
(57, 'SENSA Soluble', '1000', 12.00, 'lbs', '', 4900.00, 4000.00, NULL, 0, 1, '2025-07-01 15:28:23', '2025-07-01 15:28:23', NULL, 3, '10002', '10002', NULL),
(58, 'SENSA Fresh', '1000', 12.00, 'lbs', '', 3600.00, 1800.00, NULL, 0, 1, '2025-07-01 15:28:23', '2025-07-01 15:28:23', NULL, 3, '10003', '10003', NULL),
(59, 'SENSA Duo', '1000', 12.00, 'lbs', '', 5500.00, 3800.00, NULL, 0, 1, '2025-07-01 15:28:23', '2025-07-01 15:28:23', NULL, 3, '10004', '10004', NULL),
(60, 'Standard coffee beans', '1', 4000.00, 'lbs', 'public/products/product-1751449580571.avif', 1.00, 0.50, 'standard coffee beans description', 0, 1, '2025-07-02 09:46:20', '2025-07-21 07:13:00', NULL, 6, 'CB-WB-1', '0900786', '250kg - small cubes'),
(61, 'DD', '2', 1.00, 'lbs', 'public/products/product-1751883439313.png', 1.00, 0.50, 'DD,iiioo', 1, 1, '2025-07-07 10:17:26', '2025-07-07 11:18:43', NULL, 5, 'undefined', 'undefined', 'undefined'),
(62, 'demo Q', '3', 2.00, 'lbs', 'public/products/product-1752040554964.png', 1.00, 0.50, 'product description', 0, 1, '2025-07-09 05:56:01', '2025-07-14 11:28:59', NULL, 6, '23', '23', '332'),
(63, 'dd', '4', 1.00, 'lbs', 'public/products/product-1753102478584.PNG', 20.00, 40.00, 'dd description', 1, 1, '2025-07-21 12:54:38', '2025-07-21 12:54:49', NULL, 5, '09', '09', 'oi43');

-- --------------------------------------------------------

--
-- Table structure for table `salesFromPatners`
--

CREATE TABLE `salesFromPatners` (
  `id` int(11) NOT NULL,
  `amount` decimal(20,2) DEFAULT 0.00,
  `method` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `salesReps`
--

CREATE TABLE `salesReps` (
  `id` int(11) NOT NULL,
  `srName` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `country` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `territoryName` varchar(255) DEFAULT NULL,
  `zipCode` varchar(255) DEFAULT '1',
  `phoneNumber` varchar(255) DEFAULT '1',
  `countryCode` varchar(255) DEFAULT '1',
  `address` varchar(255) DEFAULT '1',
  `image` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `deleted` tinyint(1) DEFAULT 0,
  `registerDate` date DEFAULT '2025-07-18',
  `registerBy` enum('email','google','apple','facebook') NOT NULL DEFAULT 'email',
  `connectAccountId` varchar(255) DEFAULT NULL,
  `stripeCustomerId` varchar(255) DEFAULT NULL,
  `defaultBankAccount` varchar(255) DEFAULT NULL,
  `isAccountConnected` tinyint(1) DEFAULT 0,
  `creditLimit` int(11) DEFAULT 2000,
  `password` varchar(255) DEFAULT NULL,
  `latestOtp` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesReps`
--

INSERT INTO `salesReps` (`id`, `srName`, `email`, `country`, `city`, `state`, `territoryName`, `zipCode`, `phoneNumber`, `countryCode`, `address`, `image`, `status`, `deleted`, `registerDate`, `registerBy`, `connectAccountId`, `stripeCustomerId`, `defaultBankAccount`, `isAccountConnected`, `creditLimit`, `password`, `latestOtp`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
(1, 'Shah Nawaz', 'engrshahnawaz@gmail.com', 'United States', 'Afton', 'Wyoming', 'qw', '0001', '3024280958', '+92', 'Sigi Technologies, 2nd Floor, 2 A kibriya Town ', 'public/sales-rep/sales-rep-1751321781742.webp', 1, 0, '2025-06-30', 'email', NULL, 'cus_SbHo9fhnJQamLT', NULL, 0, 5000, '123456', NULL, '2025-06-30 22:16:22', '2025-07-01 14:33:04', NULL),
(2, 'arbab', 'baba@gmail.com', 'United States', 'Afton', 'Wyoming', 'hamza', '5400', '4334543', '+92', 'uidehuied', 'public/sales-rep/sales-rep-1751349767553.png', 1, 0, '2025-06-30', 'email', NULL, 'cus_SbYEu6V4bLqnFN', NULL, 0, 4999, '12', NULL, '2025-07-01 06:02:48', '2025-07-15 06:38:48', NULL),
(3, 'hamza', 'sigidevelopers@gmail.com', 'United States', 'South Miami', 'Florida', 'f4ef', '434', '090078601', '+92', 'Address: 9-D PIA Road, Main Boulevard, near Town ship, Lahore, 54000', 'public/sales-rep/sales-rep-1751350028701.png', 1, 0, '2025-07-01', 'email', NULL, 'cus_SbEKRqYfoN2qTh', NULL, 0, 5500, '123', 9554, '2025-07-01 06:07:09', '2025-07-15 07:31:46', NULL),
(4, 'butt', 'hamza@gmail.com', 'United States', 'Afton', 'Wyoming', 'ehwg', '7832', '67', '+92', 'uiew', 'public/sales-rep/sales-rep-1751365498020.png', 1, 0, '2025-07-01', 'email', 'acct_1Rg1N0CptYtPPvUE', 'cus_SbDoSNzkS7uZpn', NULL, 0, 200, '123456', NULL, '2025-07-01 10:24:58', '2025-07-01 10:25:04', NULL),
(5, 'Joe Argyle', 'joe@busybeancoffee.com', 'United States', 'Casselberry', 'Florida', 'Busy Bean Central Florida', '32707', '2015550123', '1', '1776 Cinnamon Circle', 'public/sales-rep/sales-rep-1751369686695.jfif', 1, 0, '2025-07-01', 'email', 'acct_1Rg2SZCY5chWihY0', 'cus_SbEwEPv1WLQulx', 'pm_1RgBYYECVLSM4sc2XrsjU9DC', 1, 8500, '123456', NULL, '2025-07-01 11:34:47', '2025-07-22 05:41:04', NULL),
(6, 'Travis Estes', 'travise211@gmail.com', 'United States', 'Summerville', 'South Carolina', 'Busy Bean Coffee of South Carolina', '29483', '6172793686', '1', '5561 Alpine Drive', NULL, 1, 1, '2025-07-01', 'email', 'acct_1Rg3vrE9Mka0nzV0', 'cus_SbGSrCEPftO3UX', NULL, 0, 100000, 'Coffee', NULL, '2025-07-01 13:09:07', '2025-07-07 17:56:16', NULL),
(7, 'select city local', 'selectcity@gmail.com', 'United States', 'fort worth', 'Texas', 'territory of fort worth', '123', '090078601', '+92', 'fghjkl', 'public/sales-rep/sales-rep-1751535690567.jfif', 1, 1, '2025-07-03', 'email', 'acct_1Rgje3CpFynKdxR1', 'cus_SbxZsg4xWp1jZn', NULL, 0, 200, '123456', NULL, '2025-07-03 09:41:31', '2025-07-03 09:41:39', NULL),
(8, 'hamza', 'hamza1@gmail.com', 'United States', 'Tequesta', 'Florida', 'hjeb', '747834', '784874378', '92', 'hyuyu', NULL, 1, 0, '2025-07-03', 'email', 'acct_1Rh317EDQFEYo2i1', 'cus_ScHaec60PE9TJL', NULL, 0, 545453, '123456', 5394, '2025-07-04 06:22:36', '2025-07-17 12:03:14', NULL),
(9, 'demo dim', 'demolocal1@gmail.com', 'United States', 'South Miami', 'Florida', 'fds', '123', '234567884', '+1', 'fdstyuiop', 'public/sales-rep/sales-rep-1751891438137.png', 1, 1, '2025-07-07', 'email', 'acct_1RiEBvEEiYFgjnFU', 'cus_SdVCnpno4HcVB4', NULL, 0, 100, '123456', NULL, '2025-07-07 12:30:38', '2025-07-07 12:30:50', NULL),
(10, 'Travis Estes', 'coffeeman@revivecoffees.com', 'United States', 'Tequesta', 'Florida', 'Busy Bean Coffee of South Carolina', '29483', '6172793686', '+1', '5561 Alpine Drive', 'public/sales-rep/sales-rep-1751904825467.jpeg', 1, 0, '2025-07-07', 'email', 'acct_1RiHfqChx3oVSK6A', 'cus_SdYn0y9EAMizCn', '123445', 1, 100000, '123456', NULL, '2025-07-07 16:13:46', '2025-07-21 17:46:39', NULL),
(11, 'novac j', 'novac@gmail.com', 'United States', 'Fort Worth', 'Texas', 'texas state territory', '1234', '0987645678', '380', 'sdfghjkl', 'public/sales-rep/sales-rep-1751953799312.jpg', 1, 1, '2025-07-07', 'email', 'acct_1RiUPkCWZur0koon', 'cus_SdlxTEgwx1dojy', NULL, 0, 1000, '123456', NULL, '2025-07-08 05:50:00', '2025-07-08 05:50:08', NULL),
(12, 'demo local og', 'demoOG@gmail.com', 'United States', 'Fort Worth', 'Texas', 'fort worth territory', '123', '098768756', '+1', 'texas christian university, fort worth, Texas', 'public/sales-rep/sales-rep-1752043017361.png', 1, 1, '2025-07-08', 'email', 'acct_1RirckCpnMFlExCv', 'cus_Se9wm4Q7TG4rtu', NULL, 0, 100, '123456', NULL, '2025-07-09 06:36:58', '2025-07-09 06:37:55', NULL),
(13, 'tetsing', 'testing@gmail.com', 'United States', 'testing', 'Florida', 'testing title', '67', '786327843', '+1', 'ygyu', NULL, 1, 0, '2025-07-15', 'email', NULL, 'cus_SgPPVKt0xAlLge', NULL, 0, 3200, '123456', NULL, '2025-07-15 06:43:34', '2025-07-15 06:43:34', NULL),
(14, 'JD', 'JD@gmail.com', 'United States', 'Panama City', 'Florida', 'roblox local', '90800', '234567890', '+1', '3456789okjhgfx', 'public/sales-rep/sales-rep-1752824510152.png', 1, 0, '2025-07-17', 'email', NULL, 'cus_ShY13BtnIc7tFJ', NULL, 0, 90000, '123', NULL, '2025-07-18 07:42:00', '2025-07-21 06:31:58', NULL),
(24, 'Arbab Hassan ', 'bobetts786@gmail.com', 'United States', 'Tallahassee', 'Florida', 'Patner of Florida', '47', '90078600', '+1', 'Address: 9-D PIA Road, Main Boulevard, near Wapda Town, Lahore, 54000', NULL, 1, 0, '2025-07-21', 'email', NULL, 'cus_Siikdp2qrnzRwq', NULL, 0, 4000, '123456', NULL, '2025-07-21 10:51:02', '2025-07-21 10:51:02', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `shippingCompanies`
--

CREATE TABLE `shippingCompanies` (
  `id` int(11) NOT NULL,
  `company` varchar(255) NOT NULL,
  `weightFrom` int(11) NOT NULL,
  `weightTo` int(11) DEFAULT NULL,
  `charges` decimal(20,2) DEFAULT 0.00,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deleted` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shippingCompanies`
--

INSERT INTO `shippingCompanies` (`id`, `company`, `weightFrom`, `weightTo`, `charges`, `createdAt`, `updatedAt`, `deleted`) VALUES
(743, 'FedEx', 0, 10, 20.00, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(744, 'FedEx', 11, 20, 30.04, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(745, 'FedEx', 21, 30, 42.63, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(746, 'FedEx', 31, 40, 53.16, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(747, 'FedEx', 41, 50, 63.30, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(748, 'FedEx', 51, 60, 65.84, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(749, 'FedEx', 61, 70, 71.76, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(750, 'FedEx', 71, 80, 80.92, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(751, 'FedEx', 81, 90, 91.45, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(752, 'FedEx', 91, 100, 99.26, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(753, 'FedEx', 101, 110, 107.72, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(754, 'FedEx', 111, 120, 115.96, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(755, 'FedEx', 121, 130, 123.67, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(756, 'FedEx', 131, 140, 134.03, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(757, 'FedEx', 141, 150, 143.27, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(758, 'FedEx', 151, 160, 173.87, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(759, 'FedEx', 161, 180, 203.61, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(760, 'FedEx', 181, 200, 243.56, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(761, 'FedEx', 201, 220, 274.04, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(762, 'FedEx', 221, 240, 302.72, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(763, 'FedEx', 241, 260, 342.59, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(764, 'FedEx', 261, 280, 373.10, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(765, 'FedEx', 281, 300, 402.18, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(766, 'FedEx', 301, 400, 444.16, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0),
(767, 'FedEx', 5000, 10000, 1.00, '2025-07-16 07:10:55', '2025-07-16 07:10:55', 0);

-- --------------------------------------------------------

--
-- Table structure for table `stateInSystems`
--

CREATE TABLE `stateInSystems` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `isoCode` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `countryInSystemId` int(11) DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `stateInSystems`
--

INSERT INTO `stateInSystems` (`id`, `name`, `isoCode`, `deleted`, `createdAt`, `updatedAt`, `countryInSystemId`, `salesRepId`) VALUES
(1, 'Alabama', 'AL', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(2, 'Alaska', 'AK', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(3, 'Arizona', 'AZ', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(4, 'Arkansas', 'AR', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(5, 'California', 'CA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(6, 'Colorado', 'CO', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(7, 'Connecticut', 'CT', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(8, 'Delaware', 'DE', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(9, 'Florida', 'FL', 0, '2025-06-30 14:15:50', '2025-07-21 10:51:02', 1, 24),
(10, 'Georgia', 'GA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(11, 'Hawaii', 'HI', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(12, 'Idaho', 'ID', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(13, 'Illinois', 'IL', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(14, 'Indiana', 'IN', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(15, 'Iowa', 'IA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(16, 'Kansas', 'KS', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(17, 'Kentucky', 'KY', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(18, 'Louisiana', 'LA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(19, 'Maine', 'ME', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(20, 'Maryland', 'MD', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(21, 'Massachusetts', 'MA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(22, 'Michigan', 'MI', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(23, 'Minnesota', 'MN', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(24, 'Mississippi', 'MS', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(25, 'Missouri', 'MO', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(26, 'Montana', 'MT', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(27, 'Nebraska', 'NE', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(28, 'Nevada', 'NV', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(29, 'New Hampshire', 'NH', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(30, 'New Jersey', 'NJ', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(31, 'New Mexico', 'NM', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(32, 'New York', 'NY', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(33, 'North Carolina', 'NC', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(34, 'North Dakota', 'ND', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(35, 'Ohio', 'OH', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(36, 'Oklahoma', 'OK', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(37, 'Oregon', 'OR', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(38, 'Pennsylvania', 'PA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(39, 'Rhode Island', 'RI', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(40, 'South Carolina', 'SC', 0, '2025-06-30 14:15:50', '2025-07-07 16:13:46', 1, 10),
(41, 'South Dakota', 'SD', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(42, 'Tennessee', 'TN', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(43, 'Texas', 'TX', 0, '2025-06-30 14:15:50', '2025-07-09 06:36:58', 1, 12),
(44, 'Utah', 'UT', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(45, 'Vermont', 'VT', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(46, 'Virginia', 'VA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(47, 'Washington', 'WA', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(48, 'West Virginia', 'WV', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(49, 'Wisconsin', 'WI', 0, '2025-06-30 14:15:50', '2025-06-30 14:15:50', 1, NULL),
(50, 'Wyoming', 'WY', 0, '2025-06-30 14:15:50', '2025-07-01 10:24:58', 1, 4);

-- --------------------------------------------------------

--
-- Table structure for table `statuses`
--

CREATE TABLE `statuses` (
  `id` int(11) NOT NULL,
  `orderStatus` varchar(255) NOT NULL,
  `discription` varchar(255) NOT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `statuses`
--

INSERT INTO `statuses` (`id`, `orderStatus`, `discription`, `deleted`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
(1, 'Order Placed', 'The business has successfully placed an order on the website.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL),
(2, 'Order Confirmed/Assigned to Supplier', 'The admin has reviewed and confirmed the order details and have assigned the order to a specific supplier for fulfillment.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL),
(3, 'Acknowledged', 'The supplier has acknowledged the order and is preparing for fulfillment.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL),
(4, 'Shipped', 'The shipment is on the way to the business.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL),
(5, 'Dispatched', 'The order has been successfully delivered to the business.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL),
(6, 'Cancelled', 'The order was canceled by the business or the admin.', 0, '2025-04-15 16:53:49', '0000-00-00 00:00:00', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `supplier`
--

CREATE TABLE `supplier` (
  `id` int(11) NOT NULL,
  `supplierName` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `country` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `zipCode` varchar(255) DEFAULT '1',
  `countryCode` varchar(255) DEFAULT '1',
  `phoneNum` varchar(255) DEFAULT '1',
  `addressOne` varchar(255) DEFAULT '1',
  `addressTwo` varchar(255) DEFAULT '1',
  `businessWeb` varchar(255) DEFAULT '1',
  `image` varchar(255) DEFAULT NULL,
  `supplierType` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `deleted` tinyint(1) DEFAULT 0,
  `registerDate` date DEFAULT NULL,
  `bankAccount` varchar(255) DEFAULT NULL,
  `businessRegistrationNumber` varchar(255) DEFAULT NULL,
  `registerBy` enum('email','google','apple','facebook') NOT NULL DEFAULT 'email',
  `password` varchar(255) DEFAULT NULL,
  `latestOtp` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supplier`
--

INSERT INTO `supplier` (`id`, `supplierName`, `email`, `country`, `city`, `state`, `zipCode`, `countryCode`, `phoneNum`, `addressOne`, `addressTwo`, `businessWeb`, `image`, `supplierType`, `status`, `deleted`, `registerDate`, `bankAccount`, `businessRegistrationNumber`, `registerBy`, `password`, `latestOtp`, `createdAt`, `updatedAt`, `deletedAt`) VALUES
(1, 'spplier name ', 'supplier40@gmail.com', 'USA', 'Miami', 'Florida', '123', '1', '567980078', 'fghj', 'bnm,', '', NULL, 'Wholesale', 1, 0, '2025-07-01', '', '', 'email', '123456', NULL, '2025-07-01 12:06:25', '2025-07-01 12:06:25', NULL),
(2, 'Elegant Supplies Co.', 'Arbab@elegantsupplies.com', 'USA', 'New York', 'NY', '10001', '+92', '3154567765', '123 Broadway Ave', 'Suite 500', 'https://elegantsupplies.com', NULL, 'Wholesale', 1, 0, '2025-04-11', '1234567890', 'REG-90872345', 'email', '123456', NULL, '2025-07-07 06:42:53', '2025-07-07 06:42:53', NULL),
(3, 'Chris allenn', 'chris@gmail.com', 'United States', 'St. Augustine Beach', 'Florida', '123', '+1', '3456789098', 'asdfghj', 'dfgheeufnei', 'www.yajoojmajooj.com', 'public/suppliers/supplier-1751871480916.jfif', 'Wholesale', 1, 0, '2025-07-07', '23456789067', '', 'email', '567890', NULL, '2025-07-07 06:58:00', '2025-07-11 06:47:32', NULL),
(4, 'Supplier', 'sigidevelopers@gmail.com', 'United States', 'jk', 'Wyoming', '51000', '+1', '3443344334', 'sd', 'sd', '', NULL, 'Wholesale', 1, 0, '2025-07-01', '2323', '', 'email', '123456', NULL, '2025-07-07 10:38:03', '2025-07-17 05:11:49', NULL),
(8, 'assd', 'sigidevelopers22@gmail.com', 'United States', 'sad', 'Wyoming', '51000', '+1', '234234234', 'asd', '', 'dsd', NULL, 'Wholesale', 1, 0, '2025-07-07', '', '', 'email', '123456', NULL, '2025-07-07 10:42:45', '2025-07-07 10:42:45', NULL),
(9, 'Busy Bean Coffee Supplies', 'travis@busybeancoffee.com', 'United States', 'summerville', 'South Carolina', '29483', '+1', '6172793686', '5561 Alpine Drive', '', 'Busy Bean Coffee', 'public/suppliers/supplier-1751909044968.png', 'Wholesale', 1, 0, '2025-07-07', '', '', 'email', '123456', NULL, '2025-07-07 17:24:05', '2025-07-07 17:24:05', NULL),
(10, 'demo og supplier', 'demosupog@gmail.com', 'United States', 'St. Petersburg', 'Florida', '45678', '+1', '345678987', 'cdcsdc', 'dcccac', 'hjkmcdc', NULL, 'Wholesale', 1, 1, '2025-07-09', '44444444444', '', 'email', '123456', NULL, '2025-07-09 06:43:00', '2025-07-09 06:43:17', NULL),
(11, 'jkiiwn', 'whatsup@gmail.com', 'United States', 'St. Pete Beach', 'Florida', '123456', '+1', '09876543456789', 'fghjkm', 'ojkl.,', 'ywiudojdw', 'public/suppliers/supplier-1752824936531.PNG', 'Wholesale', 1, 1, '2025-07-18', 'o0ytr567u8io', '', 'email', '123456', NULL, '2025-07-18 07:48:56', '2025-07-21 10:44:21', NULL),
(12, 'july testing', 'testingjuly@gmail.com', 'United States', 'Tequesta', 'Florida', '5400', '+1', '90078600', 'baba g estate', 'builders', 'https://main.d23ane9xo460ol.amplifyapp.com/', NULL, 'Wholesale', 1, 0, '2025-07-21', 'PKMEZN2093NDIOEN4', '', 'email', '123456', NULL, '2025-07-21 10:49:52', '2025-07-21 10:49:52', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `territories`
--

CREATE TABLE `territories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `countryInSystemId` int(11) DEFAULT NULL,
  `stateInSystemId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transfersToSalesReps`
--

CREATE TABLE `transfersToSalesReps` (
  `id` int(11) NOT NULL,
  `amount` varchar(255) NOT NULL,
  `tranferId` varchar(255) NOT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `orderId` int(11) DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL,
  `grossPartnerAmount` varchar(255) DEFAULT NULL,
  `proportionalStripeFee` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `image` varchar(255) DEFAULT NULL,
  `phoneNumber` varchar(255) DEFAULT NULL,
  `countryCode` varchar(255) DEFAULT NULL,
  `saleTaxNumber` varchar(255) DEFAULT NULL,
  `emailToSendInvoices` varchar(255) DEFAULT NULL,
  `companyName` varchar(255) DEFAULT NULL,
  `latestOtp` int(11) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `verifiedAt` datetime DEFAULT NULL,
  `stripeCustomerId` varchar(255) DEFAULT NULL,
  `defaultPaymentMethod` varchar(255) DEFAULT NULL,
  `registerBy` enum('email','google','apple','facebook') NOT NULL DEFAULT 'email',
  `createdBy` enum('registration','sales-rep','admin') NOT NULL DEFAULT 'registration',
  `preferredPaymentMethod` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `salesRepId` int(11) DEFAULT NULL,
  `billingAddress` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `status`, `image`, `phoneNumber`, `countryCode`, `saleTaxNumber`, `emailToSendInvoices`, `companyName`, `latestOtp`, `deleted`, `verifiedAt`, `stripeCustomerId`, `defaultPaymentMethod`, `registerBy`, `createdBy`, `preferredPaymentMethod`, `createdAt`, `updatedAt`, `deletedAt`, `salesRepId`, `billingAddress`) VALUES
(1, 'John Doe 22', 'john22@example.com', '123456', 1, NULL, '123-456-7899', '+92', 'TX1234567899', 'invoices22@company.com', '3Leven Corp', NULL, 0, NULL, 'cus_SbIRMs5dDBvpbW', NULL, 'email', 'admin', NULL, '2025-03-20 00:00:00', '2025-07-17 05:03:12', NULL, NULL, NULL),
(2, 'Ashley Russell', '4speedon50sdiner@groupstonghold.com', '123456', 1, NULL, '8593079908', NULL, NULL, '4speedon50sdiner@groupstonghold.com', '4 Speed on 50s Diner', NULL, 0, NULL, 'cus_SbIRRMc2ydR92z', NULL, 'email', 'admin', NULL, '2023-10-30 00:00:00', '2025-07-01 15:12:08', NULL, NULL, NULL),
(3, 'Janet Tuten', 'jtuten@nhihotels.com', '123456', 1, NULL, '5056854378', NULL, NULL, 'jtuten@nhihotels.com', 'Abiquiu Inn', NULL, 0, NULL, 'cus_SbIRxZtCjoxGwO', NULL, 'email', 'admin', NULL, '2023-02-22 00:00:00', '2025-07-21 09:43:23', NULL, 5, NULL),
(4, 'Liz', 'lizyland@aol.com', '123456', 1, NULL, NULL, NULL, NULL, 'lizyland@aol.com', 'Acquaro', NULL, 0, NULL, 'cus_SbIRIz3GaB22X5', NULL, 'email', 'admin', NULL, '2023-04-09 00:00:00', '2025-07-01 15:12:09', NULL, NULL, NULL),
(5, 'SKY CHENEY', 'SKYCHENEY@MSN.COM', '123456', 1, NULL, '5176551550', NULL, '38-2713194', 'SKYCHENEY@MSN.COM', 'ADMIRAL#181', NULL, 0, NULL, 'cus_SbIR3nxGU0BHXd', NULL, 'email', 'admin', NULL, '2023-01-04 00:00:00', '2025-07-01 15:12:10', NULL, NULL, NULL),
(6, 'Jason Allen', 'jallenbondys@hotmail.com', '123456', 1, NULL, '2513911688', NULL, NULL, 'jallenbondys@hotmail.com', 'AE CONSORTIUM dba X\'press Joe', NULL, 0, NULL, 'cus_SbIRGqAFV7ekD4', NULL, 'email', 'admin', NULL, '2025-02-27 00:00:00', '2025-07-01 15:12:10', NULL, NULL, NULL),
(7, 'ALOFT 51120000', 'chad.donahue@aloftjacksonvilletp.com', '123456', 1, NULL, '9044281283', NULL, NULL, 'chad.donahue@aloftjacksonvilletp.com', 'Aloft and Element International Drive', NULL, 0, NULL, 'cus_SbIRO8oBqxjufO', NULL, 'email', 'admin', NULL, '2024-05-29 00:00:00', '2025-07-01 15:12:10', NULL, NULL, NULL),
(8, 'Guido Saez', 'guido.saez@hhmhotels.com', '123456', 1, NULL, '4073184658', NULL, NULL, 'guido.saez@hhmhotels.com', 'Aloft Element Seattle Redmond', NULL, 0, NULL, 'cus_SbIRqEmCvAp5nW', NULL, 'email', 'admin', NULL, '2023-11-03 00:00:00', '2025-07-01 15:12:11', NULL, 5, NULL),
(9, 'Rashed Kanaan', 'rkanaan@csmcorp.net', '123456', 1, NULL, '7022053171', NULL, NULL, 'rkanaan@csmcorp.net', 'Aloft Jacksonville Airport', NULL, 0, NULL, 'cus_SbIREwFV1EXa6x', NULL, 'email', 'admin', NULL, '2024-10-30 00:00:00', '2025-07-01 15:12:11', NULL, 5, NULL),
(10, 'Rebecca Boyd', 'rebecca.boyd@aimbridge.com', '123456', 1, NULL, '9043808405', NULL, NULL, 'rebecca.boyd@aimbridge.com', 'AIMBRIDGE HOSPITALITY', NULL, 0, NULL, 'cus_SbIRdKdpJjWpvQ', NULL, 'email', 'admin', NULL, '2024-01-17 00:00:00', '2025-07-01 15:12:12', NULL, 5, NULL),
(11, 'James Sandoval', 'j.sandoval@aloftlakenona.com', '123456', 1, NULL, '4073133700', NULL, NULL, 'j.sandoval@aloftlakenona.com', 'Aloft Lake Nona', NULL, 0, NULL, 'cus_SbIRO5Onqpt2EH', NULL, 'email', 'admin', NULL, '2025-06-10 00:00:00', '2025-07-01 15:12:12', NULL, 5, NULL),
(12, 'Marisol Rodriguez', 'marisol.rodriguez@leximalodging.com', '123456', 1, NULL, '7277770907', NULL, NULL, 'marisol.rodriguez@leximalodging.com', 'Aloft Savannah Airport', NULL, 0, NULL, 'cus_SbIR2ZJSdburls', NULL, 'email', 'admin', NULL, '2025-02-02 00:00:00', '2025-07-01 15:12:12', NULL, 5, NULL),
(13, 'Suzanne Corey', 'suzanne@autolinepreowned.com', '123456', 1, NULL, '9042428000', NULL, NULL, 'suzanne@autolinepreowned.com', 'Autoline', NULL, 0, NULL, 'cus_SbIRttovkFtENH', NULL, 'email', 'admin', NULL, '2025-06-15 00:00:00', '2025-07-01 15:12:13', NULL, NULL, NULL),
(14, 'Katie Codd', 'bnabowls@gmail.com', '123456', 1, NULL, '4105070885', NULL, NULL, 'bnabowls@gmail.com', 'B&A Bowls', NULL, 0, NULL, 'cus_SbIRmcnbaMIjnL', NULL, 'email', 'admin', NULL, '2025-05-22 00:00:00', '2025-07-01 15:12:13', NULL, 5, NULL),
(15, 'Bjs PDC', 'mmarin@bjs.com', '123456', 1, NULL, '4078527206', NULL, NULL, 'mmarin@bjs.com', 'Bjs wholesale', NULL, 0, NULL, 'cus_SbIRnHR51eGODO', NULL, 'email', 'admin', NULL, '2025-06-06 00:00:00', '2025-07-01 15:12:14', NULL, 5, NULL),
(16, 'Carly McLendon', 'carly.mclendon@gmail.com', '123456', 1, NULL, '4077397790', NULL, NULL, 'carly.mclendon@gmail.com', 'Buster\'s Sanford', NULL, 0, NULL, 'cus_SbIRCkG8eTBlRW', NULL, 'email', 'admin', NULL, '2025-03-27 00:00:00', '2025-07-01 15:12:14', NULL, 5, NULL),
(17, 'Richard Hackett', 'richard.hackett@umm.edu', '123456', 1, NULL, '4107874130', NULL, NULL, 'richard.hackett@umm.edu', 'BWMC', NULL, 0, NULL, 'cus_SbIR1nDkFZat5B', NULL, 'email', 'admin', NULL, '2024-05-28 00:00:00', '2025-07-01 15:12:14', NULL, NULL, NULL),
(18, 'Wilmari Rivera', 'wrivera-hernandez@vhghotels.com', '123456', 1, NULL, '4075666018', NULL, NULL, 'wrivera-hernandez@vhghotels.com', 'Celebration Hotel', NULL, 0, NULL, 'cus_SbIRSRsRia0CdT', NULL, 'email', 'admin', NULL, '2022-11-11 00:00:00', '2025-07-01 15:12:15', NULL, 5, NULL),
(19, 'Jonathan Watson', 'jonathan.watson@cfhla.org', '123456', 1, NULL, '4073135011', NULL, NULL, 'jonathan.watson@cfhla.org', 'Central Florida Hotel & Lodging Association', NULL, 0, NULL, 'cus_SbIRct4zLw1Hto', NULL, 'email', 'admin', NULL, '2023-04-24 00:00:00', '2025-07-01 15:12:15', NULL, NULL, NULL),
(20, 'Erin Walsh', 'erin.walsh@cfhla.org', '123456', 1, NULL, '4073135012', NULL, NULL, 'erin.walsh@cfhla.org', 'CFHLA', NULL, 0, NULL, 'cus_SbIRqcOQx26oCq', NULL, 'email', 'admin', NULL, '2023-01-31 00:00:00', '2025-07-01 15:12:16', NULL, NULL, NULL),
(21, 'Cory Greenough', 'cgrj@chevron.com', '123456', 1, NULL, '2289384329', NULL, NULL, 'cgrj@chevron.com', 'Chevron', NULL, 0, NULL, 'cus_SbIRqOKQjsiUgX', NULL, 'email', 'admin', NULL, '2024-04-08 00:00:00', '2025-07-01 15:12:16', NULL, 5, NULL),
(22, 'Stacey Smith', 'staceysmith@chevron.com', '123456', 1, NULL, '2282178274', NULL, NULL, 'staceysmith@chevron.com', 'Chevron Product', NULL, 0, NULL, 'cus_SbIROXFosbs748', NULL, 'email', 'admin', NULL, '2022-10-28 00:00:00', '2025-07-01 15:12:16', NULL, 5, NULL),
(23, 'Angie Crawford', 'officemanager@christianlightministries.org', '123456', 1, NULL, '9047329567', NULL, NULL, 'officemanager@christianlightministries.org', 'Christian Light Ministries', NULL, 0, NULL, 'cus_SbIRph0P66nx0j', NULL, 'email', 'admin', NULL, '2025-03-13 00:00:00', '2025-07-01 15:12:17', NULL, NULL, NULL),
(24, 'Iliarosa Rivera', 'iliarosa.rivera@wyn.com', '123456', 1, NULL, '4073134650', NULL, NULL, 'iliarosa.rivera@wyn.com', 'Club Wyndham Bonnet Creek', NULL, 0, NULL, 'cus_SbIRn1QuqwiPJA', NULL, 'email', 'admin', NULL, '2022-02-17 00:00:00', '2025-07-01 15:12:17', NULL, 5, NULL),
(25, 'shamil babilonia', 'babiloniashamil@yahoo.com', '123456', 1, NULL, '4073134650', NULL, NULL, 'babiloniashamil@yahoo.com', 'Coco Key Hotel', NULL, 0, NULL, 'cus_SbIRx8tN4wMFV7', NULL, 'email', 'admin', NULL, '2022-01-26 00:00:00', '2025-07-01 15:12:18', NULL, 5, NULL),
(26, 'Dariusz Szczepura', 'dariusz@busybeancoffee.com', '123456', 1, NULL, '7043101307', NULL, NULL, 'dariusz@busybeancoffee.com', 'CoCoTech USA', NULL, 0, NULL, 'cus_SbIRQdrGyhzIST', NULL, 'email', 'admin', NULL, '2024-09-30 00:00:00', '2025-07-01 15:12:18', NULL, NULL, NULL),
(27, 'Nancy Rodriguez', 'nancy.rodriguez@filtrationgroup.com', '123456', 1, NULL, '4073184658', NULL, NULL, 'nancy.rodriguez@filtrationgroup.com', 'Conair Industries', NULL, 0, NULL, 'cus_SbIR8MPSEilaLC', NULL, 'email', 'admin', NULL, '2022-06-06 00:00:00', '2025-07-01 15:12:18', NULL, 5, NULL),
(28, 'Stephanie Warren', 'stephaniewarren@originalpopcornhouse.com', '123456', 1, NULL, '4105070885', NULL, NULL, 'stephaniewarren@originalpopcornhouse.com', 'Cookies & Cream Cafe', NULL, 0, NULL, 'cus_SbIRMeBoA2vuht', NULL, 'email', 'admin', NULL, '2022-11-16 00:00:00', '2025-07-01 15:12:19', NULL, NULL, NULL),
(29, 'Crafty Merchandising', 'procurement@craftydelivers.com', '123456', 1, NULL, '5107971400', NULL, NULL, 'procurement@craftydelivers.com', 'Crafty Merchandising', NULL, 0, NULL, 'cus_SbIREbfvXdBj4C', NULL, 'email', 'admin', NULL, '2023-09-22 00:00:00', '2025-07-01 15:12:19', NULL, NULL, NULL),
(30, 'Thecrependip', 'thecrependip@gmail.com', '123456', 1, NULL, '5132399380', NULL, NULL, 'thecrependip@gmail.com', 'Crepe n dip', NULL, 0, NULL, 'cus_SbIREBDrzaJGFj', NULL, 'email', 'admin', NULL, '2025-03-17 00:00:00', '2025-07-01 15:12:20', NULL, NULL, NULL),
(31, 'Claudia Vazquez', 'agm@cplbvorlando.com', '123456', 1, NULL, '4073135000', NULL, NULL, 'agm@cplbvorlando.com', 'Central Florida Public Service Credit Union', NULL, 0, NULL, 'cus_SbIS54wKVVF2wq', NULL, 'email', 'admin', NULL, '2025-02-13 00:00:00', '2025-07-01 15:12:20', NULL, 5, NULL),
(32, 'Keith Thoresen', 'keith.thoresen@cscsteelusa.com', '123456', 1, NULL, '4073136400', NULL, NULL, 'keith.thoresen@cscsteelusa.com', 'CSC Steel', NULL, 0, NULL, 'cus_SbIS9wPnTRXaH3', NULL, 'email', 'admin', NULL, '2025-01-20 00:00:00', '2025-07-01 15:12:20', NULL, 5, NULL),
(33, 'Debbie Ferhat', 'dyferhat@yuengling.com', '123456', 1, NULL, '8566862221', NULL, NULL, 'dyferhat@yuengling.com', 'Yuengling & Son, Inc.', NULL, 0, NULL, 'cus_SbISVIfg9SPVOq', NULL, 'email', 'admin', NULL, '2025-03-04 00:00:00', '2025-07-01 15:12:21', NULL, 5, NULL),
(34, 'Jake Dadon', 'jake@dadonrealestate.com', '123456', 1, NULL, '9541234567', NULL, NULL, 'jake@dadonrealestate.com', 'DaDon Real Estate', NULL, 0, NULL, 'cus_SbISgOYDph5uBM', NULL, 'email', 'admin', NULL, '2025-04-01 00:00:00', '2025-07-01 15:12:21', NULL, NULL, NULL),
(35, 'Dawn Holman', 'dawnholman73@aol.com', '123456', 1, NULL, '4172734567', NULL, NULL, 'dawnholman73@aol.com', 'Dawn Holman', NULL, 0, NULL, 'cus_SbISlV8xa1vSfF', NULL, 'email', 'admin', NULL, '2025-04-15 00:00:00', '2025-07-01 15:12:21', NULL, NULL, NULL),
(36, 'Jean Walker', 'jean.walker@pulte.com', '123456', 1, NULL, '9042734567', NULL, NULL, 'jean.walker@pulte.com', 'Pulte Homes', NULL, 0, NULL, 'cus_SbIS67JUtIu8XH', NULL, 'email', 'admin', NULL, '2025-05-10 00:00:00', '2025-07-01 15:12:22', NULL, NULL, NULL),
(37, 'Jorge Torres', 'jorge.torres@deltamarriottorlando.com', '123456', 1, NULL, '4073139012', NULL, NULL, 'jorge.torres@deltamarriottorlando.com', 'Delta Marriott Orlando', NULL, 0, NULL, 'cus_SbISgJi0uckQZn', NULL, 'email', 'admin', NULL, '2025-06-01 00:00:00', '2025-07-01 15:12:22', NULL, 5, NULL),
(38, 'Discovery Dental', 'discoverydental@gmail.com', '123456', 1, NULL, '4073139023', NULL, NULL, 'discoverydental@gmail.com', 'Discovery Dental', NULL, 0, NULL, 'cus_SbISXBZIEgQtHN', NULL, 'email', 'admin', NULL, '2025-06-05 00:00:00', '2025-07-01 15:12:23', NULL, 5, NULL),
(39, 'Diego Flores-Gibbens', 'diego@dolceneve.com', '123456', 1, NULL, '7079713860', NULL, NULL, 'diego@dolceneve.com', 'Dolce Neve Inc.', NULL, 0, NULL, 'cus_SbISWP3yNWzb9P', NULL, 'email', 'admin', NULL, '2025-06-10 00:00:00', '2025-07-01 15:12:23', NULL, NULL, NULL),
(40, 'Kitchen Manager & Benjamin Davila', 'odavila@doubletreeorlandosw.com', '123456', 1, NULL, '4073139035', NULL, NULL, 'odavila@doubletreeorlandosw.com', 'DoubleTree by Hilton at SeaWorld', NULL, 0, NULL, 'cus_SbIS9jVKADPYrY', NULL, 'email', 'admin', NULL, '2025-06-10 00:00:00', '2025-07-01 15:12:23', NULL, 5, NULL),
(41, 'Anthony Fothergill', 'Anthony.fothergill@hilton.com', '123456', 1, NULL, '4073139036', NULL, NULL, 'Anthony.fothergill@hilton.com', 'Doubletree Orlando At Universal', NULL, 0, NULL, 'cus_SbISWpw4kKOc62', NULL, 'email', 'admin', NULL, '2025-06-15 00:00:00', '2025-07-01 15:12:24', NULL, 5, NULL),
(42, 'Food & Beverage', 'Eric@downtowncrowne.com', '123456', 1, NULL, '4073139037', NULL, NULL, 'Eric@downtowncrowne.com', 'Downtown Crowne Plaza Hotel', NULL, 0, NULL, 'cus_SbISTnLPp59Lv5', NULL, 'email', 'admin', NULL, '2025-06-20 00:00:00', '2025-07-01 15:12:24', NULL, 5, NULL),
(43, 'Andy Herrera', 'aherrera@yuenglingdhk.com', '123456', 1, NULL, '4073139038', NULL, NULL, 'aherrera@yuenglingdhk.com', 'Draft Haus & Kitchen - Yuengling', NULL, 0, NULL, 'cus_SbISOLNmjtAmY0', NULL, 'email', 'admin', NULL, '2025-06-25 00:00:00', '2025-07-01 15:12:25', NULL, 5, NULL),
(44, 'Stacy Scitticatt', 'stacymcmahan1974@gmail.com', '123456', 1, NULL, '4073139039', NULL, NULL, 'stacymcmahan1974@gmail.com', 'Esthetics and Day Spa', NULL, 0, NULL, 'cus_SbISbDC7LZUn8X', NULL, 'email', 'admin', NULL, '2025-06-30 00:00:00', '2025-07-01 15:12:25', NULL, NULL, NULL),
(45, 'Luisa Collazo', 'luisa.collazo@hilton.com', '123456', 1, NULL, '4073139040', NULL, NULL, 'luisa.collazo@hilton.com', 'Embassy Suites', NULL, 0, NULL, 'cus_SbIS6Rw9pWP6lK', NULL, 'email', 'admin', NULL, '2025-07-01 00:00:00', '2025-07-01 15:12:25', NULL, 5, NULL),
(46, 'Jo Costa', 'joanna.costa@hilton.com', '123456', 1, NULL, '4073139041', NULL, NULL, 'joanna.costa@hilton.com', 'Hilton Orlando North', NULL, 0, NULL, 'cus_SbISw13by8yBbw', NULL, 'email', 'admin', NULL, '2025-07-02 00:00:00', '2025-07-01 15:12:26', NULL, 5, NULL),
(47, 'Judiel Quintana', 'judiel.quintana@hilton.com', '123456', 1, NULL, '4073139042', NULL, NULL, 'judiel.quintana@hilton.com', 'Embassy Suites Downtown Orlando', NULL, 0, NULL, 'cus_SbIS7LPUW6pYdL', NULL, 'email', 'admin', NULL, '2025-07-03 00:00:00', '2025-07-01 15:12:26', NULL, 5, NULL),
(48, 'William Funcheon', 'william_funcheon@equitylifestyle.com', '123456', 1, NULL, '4073139043', NULL, NULL, 'william_funcheon@equitylifestyle.com', 'Equity Lifestyle/Caribbean Jack\'s', NULL, 0, NULL, 'cus_SbISUpgH0Skidk', NULL, 'email', 'admin', NULL, '2025-07-04 00:00:00', '2025-07-01 15:12:27', NULL, 5, NULL),
(49, 'Lisa Gufford', 'lgufford@gmail.com', '123456', 1, NULL, '9043135080', NULL, NULL, 'lgufford@gmail.com', 'Live Oak Suites Professional', NULL, 0, NULL, 'cus_SbISBMAh7Mo91n', NULL, 'email', 'admin', NULL, '2025-02-28 00:00:00', '2025-07-01 15:12:27', NULL, NULL, NULL),
(50, 'Exhibit at Jtown', 'exhibitatjtownmgr@greystar.com', '123456', 1, NULL, '4083135090', NULL, NULL, 'exhibitatjtownmgr@greystar.com', 'Exhibit JTown', NULL, 0, NULL, 'cus_SbISBEG4ubOcOf', NULL, 'email', 'admin', NULL, '2025-01-15 00:00:00', '2025-07-01 15:12:27', NULL, 5, NULL),
(51, 'Natalie Bastos', 'natalie.bastos@fairfieldorlando.com', '123456', 1, NULL, '4073135100', NULL, NULL, 'natalie.bastos@fairfieldorlando.com', 'Fairfield Inn & Suites Orlando Airport', NULL, 0, NULL, 'cus_SbISqsGVEQjtU9', NULL, 'email', 'admin', NULL, '2025-03-12 00:00:00', '2025-07-01 15:12:28', NULL, 5, NULL),
(52, 'Natalie Bastos', 'natalie.bastos@marriott.com', '123456', 1, NULL, '4073135110', NULL, NULL, 'natalie.bastos@marriott.com', 'TownePlace Suites Lake Buena Vista', NULL, 0, NULL, 'cus_SbIS4F9BvpqynP', NULL, 'email', 'admin', NULL, '2025-03-12 00:00:00', '2025-07-01 15:12:28', NULL, 5, NULL),
(53, 'Travis Estes', 'travise211@gmail.com', 'COFFEEBEAN2025!', 1, NULL, '8433135120', NULL, NULL, 'travise211@gmail.com', 'Fake Account', 3484, 0, NULL, 'cus_SbIS8AGqmhDLi8', NULL, 'email', 'admin', NULL, '2025-04-05 00:00:00', '2025-07-07 17:50:20', NULL, NULL, NULL),
(54, 'Jim Lee', 'jlee@fantasyworldtimeshare.com', '123456', 1, NULL, '4073135130', NULL, NULL, 'jlee@fantasyworldtimeshare.com', 'FantasyWorld Resort', NULL, 0, NULL, 'cus_SbISGimBqCN4k8', NULL, 'email', 'admin', NULL, '2025-05-18 00:00:00', '2025-07-01 15:12:29', NULL, 5, NULL),
(55, 'Debbie Reardon', 'debbie.reardon@fieldsauto.com', '123456', 1, NULL, '4073135140', NULL, NULL, 'debbie.reardon@fieldsauto.com', 'Fields Collision Center', NULL, 0, NULL, 'cus_SbISQWwocv7Ivb', NULL, 'email', 'admin', NULL, '2025-06-20 00:00:00', '2025-07-01 15:12:29', NULL, 5, NULL),
(56, 'Richard Fisher', 'orangecrate44@yahoo.com', '123456', 1, NULL, '3303135150', NULL, NULL, 'orangecrate44@yahoo.com', 'Fishers Café & Pub', NULL, 0, NULL, 'cus_SbISETAiErxN1I', NULL, 'email', 'admin', NULL, '2025-06-25 00:00:00', '2025-07-01 15:12:30', NULL, NULL, NULL),
(57, 'Jose Gomes', 'jose.gomes@aimbridge.com', '123456', 1, NULL, '4073135160', NULL, NULL, 'jose.gomes@aimbridge.com', 'AIT Suites International Drive', NULL, 0, NULL, 'cus_SbIS7z0zSTb3oJ', NULL, 'email', 'admin', NULL, '2025-06-29 00:00:00', '2025-07-01 15:12:30', NULL, 5, NULL),
(58, 'Walter Clay', 'walter.clay@earthlink.net', '123456', 1, NULL, '7067374865', NULL, NULL, 'walter.clay@earthlink.net', 'French Market Grill', NULL, 0, NULL, 'cus_SbISO7vraWOEpV', NULL, 'email', 'admin', NULL, '2023-01-23 00:00:00', '2025-07-01 15:12:30', NULL, NULL, NULL),
(59, 'Kimani Cordero', 'kcordero@schmidtfutures.com', '123456', 1, NULL, '6469449646', NULL, NULL, 'kcordero@schmidtfutures.com', 'Futures Action Network LLC', NULL, 0, NULL, 'cus_SbISE0xegi3PvH', NULL, 'email', 'admin', NULL, '2022-03-11 00:00:00', '2025-07-01 15:12:31', NULL, NULL, NULL),
(60, 'Josh Grigg', 'josh@gmhbuild.com', '123456', 1, NULL, '7077575050', NULL, NULL, 'josh@gmhbuild.com', 'GMH Builders, Inc.', NULL, 0, NULL, 'cus_SbISI8usbSeaGa', NULL, 'email', 'admin', NULL, '2023-02-01 00:00:00', '2025-07-01 15:12:31', NULL, NULL, NULL),
(61, 'Pamala Good', 'dr.good@goodsmiles.com', '123456', 1, NULL, '8502287333', NULL, NULL, 'dr.good@goodsmiles.com', 'GoodSmiles Dental Care', NULL, 0, NULL, 'cus_SbISr1UE5kMPU4', NULL, 'email', 'admin', NULL, '2025-04-28 00:00:00', '2025-07-01 15:12:32', NULL, NULL, NULL),
(62, 'Katelyn McFall', 'kebmcfall@outlook.com', '123456', 1, NULL, '7315497081', NULL, NULL, 'kebmcfall@outlook.com', 'Grindhead Coffee', NULL, 0, NULL, 'cus_SbIS6n5SNxRlFg', NULL, 'email', 'admin', NULL, '2023-12-28 00:00:00', '2025-07-01 15:12:32', NULL, 5, NULL),
(63, 'ANGIE TSOURIS', 'angie@gulfcoastmarine.com', '123456', 1, NULL, '2287629282', NULL, NULL, 'angie@gulfcoastmarine.com', 'GULF COAST MARINE SUPPLY', NULL, 0, NULL, 'cus_SbISaQmaNxln0A', NULL, 'email', 'admin', NULL, '2023-07-12 00:00:00', '2025-07-01 15:12:32', NULL, 5, NULL),
(64, 'Attn: Receiving', 'apinvoice@loewshotels.com', '123456', 1, NULL, '(407) 503-2438', NULL, NULL, 'apinvoice@loewshotels.com', 'Hard Rock Hotel, A Loews Hotel', NULL, 0, NULL, 'cus_SbISOkla4vqoOk', NULL, 'email', 'admin', NULL, '2022-02-28 00:00:00', '2025-07-01 15:12:33', NULL, 5, NULL),
(65, 'Amy Ledeboer', 'amy@thehealthypaws.com', '123456', 1, NULL, '9205502147', NULL, NULL, 'amy@thehealthypaws.com', 'Healthy Paws Veterinary Clinic', NULL, 0, NULL, 'cus_SbISQtulupF6Dx', NULL, 'email', 'admin', NULL, '2023-09-20 00:00:00', '2025-07-01 15:12:33', NULL, 5, NULL),
(66, 'Jeremy Tsusaki', 'jeremy.tsusaki@loewshotels.com', '123456', 1, NULL, '689-218-1000', NULL, NULL, 'jeremy.tsusaki@loewshotels.com', 'Helios Grand Hotel, A Loews Hotel', NULL, 0, NULL, 'cus_SbISv2FXAHnakn', NULL, 'email', 'admin', NULL, '2025-04-21 00:00:00', '2025-07-01 15:12:34', NULL, 5, NULL),
(67, 'Kens Augustin', 'kens.augustin@hilton.com', '123456', 1, NULL, '4079925000', NULL, NULL, 'kens.augustin@hilton.com', 'Hilton Garden Inn East Orlando', NULL, 0, NULL, 'cus_SbISjyxWq4YE1B', NULL, 'email', 'admin', NULL, '2024-10-07 00:00:00', '2025-07-01 15:12:34', NULL, 5, NULL),
(68, 'ENDY PAUL', 'endy.paul@hiuniversalorlando.com', '123456', 1, NULL, '4076159465', NULL, NULL, 'endy.paul@hiuniversalorlando.com', 'Holiday Inn & Suites Across from Universal Orlando', NULL, 0, NULL, 'cus_SbISJuHSMFJZNO', NULL, 'email', 'admin', NULL, '2023-09-29 00:00:00', '2025-07-01 15:12:34', NULL, 5, NULL),
(69, 'Greg Hischuck', 'gregory.hischuck@hiresortlbv.com', '123456', 1, NULL, '4073135180', NULL, NULL, 'gregory.hischuck@hiresortlbv.com', 'Hilton Orlando Lake Buena Vista', NULL, 0, NULL, 'cus_SbISooWRgQirQ3', NULL, 'email', 'admin', NULL, '2025-06-16 00:00:00', '2025-07-01 15:12:35', NULL, 5, NULL),
(70, 'Phil Infante', 'pinfante@cporlando.com', '123456', 1, NULL, '4073135190', NULL, NULL, 'pinfante@cporlando.com', 'Courtyard by Marriott Orlando Lake Buena Vista', NULL, 0, NULL, 'cus_SbISWKyTL2rX94', NULL, 'email', 'admin', NULL, '2025-06-17 00:00:00', '2025-07-01 15:12:35', NULL, 5, NULL),
(71, 'Sarah Robinson', 'sarah.robinson@hhmhotels.com', '123456', 1, NULL, '4073551136', NULL, NULL, 'sarah.robinson@hhmhotels.com', 'H HM Hotels & Resorts', NULL, 0, NULL, 'cus_SbIS0gJEEA5fPb', NULL, 'email', 'admin', NULL, '2025-06-30 16:57:23', '2025-07-01 15:12:36', NULL, NULL, NULL),
(72, 'Schaevon L Miller', 'schaevon.miller@hhmhotels.com', '123456', 1, NULL, '4073551137', NULL, NULL, 'schaevon.miller@hhmhotels.com', 'HHM Hotels & Resorts - Universal Blvd', NULL, 0, NULL, 'cus_SbISXqOoD7dEP2', NULL, 'email', 'admin', NULL, '2025-07-01 09:00:00', '2025-07-01 15:12:36', NULL, 5, NULL),
(73, 'Accounts Payable', 'accountingkwest@hyatt.com', '123456', 1, NULL, '3052964600', NULL, NULL, 'accountingkwest@hyatt.com', 'Hyatt Centric Key West Resort & Spa', NULL, 0, NULL, 'cus_SbISuP8ULwYLKw', NULL, 'email', 'admin', NULL, '2025-01-15 00:00:00', '2025-07-01 15:12:36', NULL, 5, NULL),
(74, 'Tony Morales', 'tony.morales@hyatt.com', '123456', 1, NULL, '4073139042', NULL, NULL, 'tony.morales@hyatt.com', 'Hyatt House Orlando Airport', NULL, 0, NULL, 'cus_SbISJBFZQ6Oje8', NULL, 'email', 'admin', NULL, '2025-02-20 00:00:00', '2025-07-01 15:12:37', NULL, 5, NULL),
(75, 'Justin Ness', 'justin.ness@hyatt.com', '123456', 1, NULL, '4073139043', NULL, NULL, 'justin.ness@hyatt.com', 'Hyatt House Orlando Universal', NULL, 0, NULL, 'cus_SbISMinnBGHWpj', NULL, 'email', 'admin', NULL, '2025-03-10 00:00:00', '2025-07-01 15:12:37', NULL, 5, NULL),
(76, 'Jordyn Williams', 'jordyn.williams@hyatt.com', '123456', 1, NULL, '4073139044', NULL, NULL, 'jordyn.williams@hyatt.com', 'Hyatt House Orlando Across from Universal', NULL, 0, NULL, 'cus_SbISkpI85kCHfU', NULL, 'email', 'admin', NULL, '2025-04-05 00:00:00', '2025-07-01 15:12:38', NULL, 5, NULL),
(77, 'Peter', 'peter.prokos@hyatt.com', '123456', 1, NULL, '407-370-4720', NULL, NULL, 'peter.prokos@hyatt.com', 'Hyatt Place Orlando Convention Center', NULL, 0, NULL, 'cus_SbISS4JmD6Pxfv', NULL, 'email', 'admin', NULL, '2023-06-06 00:00:00', '2025-07-01 15:12:38', NULL, 5, NULL),
(78, 'Sylvain Tonello', 'sylvain.tonello@hyatt.com', '123456', 1, NULL, '7035076711', NULL, NULL, 'sylvain.tonello@hyatt.com', 'Hyatt Regency Coral Gables', NULL, 0, NULL, 'cus_SbISQWXbnZ659h', NULL, 'email', 'admin', NULL, '2023-06-06 00:00:00', '2025-07-01 15:12:38', NULL, 5, NULL),
(79, 'Jose Barriga', 'jose.barriga@hyatt.com', '123456', 1, NULL, '(407) 239-3884', NULL, NULL, 'jose.barriga@hyatt.com', 'HYATT REGENCY GRAND CYPRESS', NULL, 0, NULL, 'cus_SbISLGf8tbbCwK', NULL, 'email', 'admin', NULL, '2022-01-26 00:00:00', '2025-07-01 15:12:39', NULL, 5, NULL),
(80, 'GARETH D\'ANGELO', 'gareth.dangelo@hyatt.com', '123456', 1, NULL, '14073454424', NULL, NULL, 'gareth.dangelo@hyatt.com', 'Hyatt Regency Orlando', NULL, 0, NULL, 'cus_SbISMkHbcFijDk', NULL, 'email', 'admin', NULL, '2023-10-11 00:00:00', '2025-07-01 15:12:39', NULL, 5, NULL),
(81, 'Travis Estes', 'info@innoendo.com', '123456', 1, NULL, '(843) 650-3636', NULL, NULL, 'info@innoendo.com', 'IInnovative Endodontics MB', NULL, 0, NULL, 'cus_SbISC940RXnIcT', NULL, 'email', 'admin', NULL, '2025-02-07 00:00:00', '2025-07-01 15:12:40', NULL, NULL, NULL),
(82, 'Nancy McKaig', 'ibxmercantile@gmail.com', '123456', 1, NULL, '2527660180', NULL, NULL, 'ibxmercantile@gmail.com', 'Inner Banks Mercantile', NULL, 0, NULL, 'cus_SbISLO6qwKxRJU', NULL, 'email', 'admin', NULL, '2022-06-12 00:00:00', '2025-07-01 15:12:40', NULL, NULL, NULL),
(83, 'Monica Estes', 'smiledoctordmd@yahoo.com', '123456', 1, NULL, '843-899-7668', NULL, NULL, 'smiledoctordmd@yahoo.com', 'Innovative Endodontics', NULL, 0, NULL, 'cus_SbISGREi0GpieP', NULL, 'email', 'admin', NULL, '2022-02-21 00:00:00', '2025-07-01 15:12:40', NULL, NULL, NULL),
(84, 'Dara DeBolt', 'innoendo.billing@gmail.com', '123456', 1, NULL, '8439003414', NULL, NULL, 'innoendo.billing@gmail.com', 'Innovative Endodontics Stallsville', NULL, 0, NULL, 'cus_SbISiYDGdEWNJC', NULL, 'email', 'admin', NULL, '2025-02-27 00:00:00', '2025-07-01 15:12:41', NULL, NULL, NULL),
(85, 'Dr Estes', 'info@busybeancoffee.com', '123456', 1, NULL, '6172793686', NULL, NULL, 'info@busybeancoffee.com', 'Innovative Endodontics- Stallsville', NULL, 0, NULL, 'cus_SbISksYSkgu0LQ', NULL, 'email', 'admin', NULL, '2023-03-21 00:00:00', '2025-07-01 15:12:41', NULL, NULL, NULL),
(86, 'Shecara Jones', 'malachi0306@yahoo.com', '123456', 1, NULL, '9048604783', NULL, NULL, 'malachi0306@yahoo.com', 'J1\'s Trucking Services LLC', NULL, 0, NULL, 'cus_SbIS3h3AQmItxt', NULL, 'email', 'admin', NULL, '2025-06-02 00:00:00', '2025-07-01 15:12:42', NULL, NULL, NULL),
(87, 'Darla Parson', 'darla@jaxexecutive.com', '123456', 1, NULL, '9044202000', NULL, NULL, 'darla@jaxexecutive.com', 'Jax Executive Jet Center', NULL, 0, NULL, 'cus_SbISQ7ZuItM3Ey', NULL, 'email', 'admin', NULL, '2025-05-29 00:00:00', '2025-07-01 15:12:42', NULL, NULL, NULL),
(88, 'RON BARASO', 'JR_BARASO@JENKINSCARS.COM', '123456', 1, NULL, '9044203100', NULL, NULL, 'JR_BARASO@JENKINSCARS.COM', 'JENKINS HYUNDAI OF JACKSONVILLE', NULL, 0, NULL, 'cus_SbISJiE2z7vjjV', NULL, 'email', 'admin', NULL, '2025-03-10 00:00:00', '2025-07-01 15:12:43', NULL, NULL, NULL),
(89, 'Will', 'William.chae@jlrestaurantmgmt.com', '123456', 1, NULL, '4073135170', NULL, NULL, 'William.chae@jlrestaurantmgmt.com', 'JL Restaurant Management', NULL, 0, NULL, 'cus_SbISTJbcKcQdYD', NULL, 'email', 'admin', NULL, '2025-01-10 00:00:00', '2025-07-01 15:12:43', NULL, NULL, NULL),
(90, 'Joe Argyle', 'joebusybean@gmail.com', '123456', 1, NULL, '4073135171', NULL, NULL, 'joebusybean@gmail.com', 'Busy Bean (Do not Invoice)', NULL, 0, NULL, 'cus_SbIS67rfYVpBkl', NULL, 'email', 'admin', NULL, '2025-01-11 00:00:00', '2025-07-01 15:12:43', NULL, 5, NULL),
(91, 'Jonathon Adamosky', 'laallme@gmail.com', '123456', 1, NULL, '4073135172', NULL, NULL, 'laallme@gmail.com', 'JTV Gems', NULL, 0, NULL, 'cus_SbISZRiFSnxDeo', NULL, 'email', 'admin', NULL, '2025-01-12 00:00:00', '2025-07-01 15:12:44', NULL, NULL, NULL),
(92, 'Gabriel Ruiz', 'K9W.Ruiz@gmail.com', '123456', 1, NULL, '4073135173', NULL, NULL, 'K9W.Ruiz@gmail.com', 'K9 Warriors Inc', NULL, 0, NULL, 'cus_SbISWtjITroAlz', NULL, 'email', 'admin', NULL, '2025-01-13 00:00:00', '2025-07-01 15:12:44', NULL, NULL, NULL),
(93, 'Karen', 'kdlewis12@aol.com', '123456', 1, NULL, '9046351234', NULL, NULL, 'kdlewis12@aol.com', 'Karen’s Catering LLC', NULL, 0, NULL, 'cus_SbISR6pnbcbJim', NULL, 'email', 'admin', NULL, '2025-01-14 00:00:00', '2025-07-01 15:12:45', NULL, NULL, NULL),
(94, 'Derika Miller', 'derika.miller@knchlaw.com', '123456', 1, NULL, '4073135174', NULL, NULL, 'derika.miller@knchlaw.com', 'KNCH Law', NULL, 0, NULL, 'cus_SbISCQqq5WnGwk', NULL, 'email', 'admin', NULL, '2025-01-15 00:00:00', '2025-07-01 15:12:45', NULL, NULL, NULL),
(95, 'Rich Andrzejewski', 'rich.andrzejewski@hyatt.com', '123456', 1, NULL, '4073135175', NULL, NULL, 'rich.andrzejewski@hyatt.com', 'KPMG Lakehouse', NULL, 0, NULL, 'cus_SbIS0tfScvIFdl', NULL, 'email', 'admin', NULL, '2025-01-16 00:00:00', '2025-07-01 15:12:45', NULL, 5, NULL),
(96, 'Cheryl Morrow', 'julie@landmarktitle.com', '123456', 1, NULL, '9043135176', NULL, NULL, 'julie@landmarktitle.com', 'Landmark Title', NULL, 0, NULL, 'cus_SbIST6EQBQ7g2G', NULL, 'email', 'admin', NULL, '2025-01-17 00:00:00', '2025-07-01 15:12:46', NULL, NULL, NULL),
(97, 'Kevin Fitzpatrick', 'Kevin.Fitzpatrick@hgv.com', '123456', 1, NULL, '4073135177', NULL, NULL, 'Kevin.Fitzpatrick@hgv.com', 'Liki Tiki Village', NULL, 0, NULL, 'cus_SbIS3X2U8sjRuE', NULL, 'email', 'admin', NULL, '2025-01-18 00:00:00', '2025-07-01 15:12:46', NULL, 5, NULL),
(98, 'Michael Belmonte', 'michael.belmonte@hgv.com', '123456', 1, NULL, '4073135178', NULL, NULL, 'michael.belmonte@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISma6rsNJJ4A', NULL, 'email', 'admin', NULL, '2025-01-19 00:00:00', '2025-07-01 15:12:47', NULL, 5, NULL),
(99, 'Santiago Alontaga', 'santiago.alontaga@hgv.com', '123456', 1, NULL, '4073135179', NULL, NULL, 'santiago.alontaga@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISLHbDaX1CwJ', NULL, 'email', 'admin', NULL, '2025-01-20 00:00:00', '2025-07-01 15:12:47', NULL, 5, NULL),
(100, 'Jessica Gieber', 'jessica.gieber@hgv.com', '123456', 1, NULL, '4073135180', NULL, NULL, 'jessica.gieber@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISWY2c1EjUgc', NULL, 'email', 'admin', NULL, '2025-01-21 00:00:00', '2025-07-01 15:12:47', NULL, 5, NULL),
(101, 'Nickolette Fernandez', 'nickolette.fernandez@hgv.com', '123456', 1, NULL, '4073135181', NULL, NULL, 'nickolette.fernandez@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISD3kb6hkvSY', NULL, 'email', 'admin', NULL, '2025-01-22 00:00:00', '2025-07-01 15:12:48', NULL, 5, NULL),
(102, 'Julian Rios', 'julian.rios@hgv.com', '123456', 1, NULL, '4073135182', NULL, NULL, 'julian.rios@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISU3QZIhyosO', NULL, 'email', 'admin', NULL, '2025-01-23 00:00:00', '2025-07-01 15:12:48', NULL, 5, NULL),
(103, 'Beverly Holland-Smith', 'beverly.holland-smith@hgv.com', '123456', 1, NULL, '4073135183', NULL, NULL, 'beverly.holland-smith@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISKCwcNdAPy7', NULL, 'email', 'admin', NULL, '2025-01-24 00:00:00', '2025-07-01 15:12:49', NULL, 5, NULL),
(104, 'Kelsey Hintz', 'kelsey.hintz@hgv.com', '123456', 1, NULL, '4073135184', NULL, NULL, 'kelsey.hintz@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISlATxujz0Vy', NULL, 'email', 'admin', NULL, '2025-01-25 00:00:00', '2025-07-01 15:12:49', NULL, NULL, NULL),
(105, 'MATEO MARCASCIANO', 'mateo.marcasci@hgv.com', '123456', 1, NULL, '4073135185', NULL, NULL, 'mateo.marcasci@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISB1JH1AToqv', NULL, 'email', 'admin', NULL, '2025-01-26 00:00:00', '2025-07-01 15:12:49', NULL, 5, NULL),
(106, 'Thomas McGuckin', 'thomas.mcguckin@hgv.com', '123456', 1, NULL, '4073135186', NULL, NULL, 'thomas.mcguckin@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbIStnawCTUaU9', NULL, 'email', 'admin', NULL, '2025-01-27 00:00:00', '2025-07-01 15:12:50', NULL, NULL, NULL),
(107, 'Taltha Motter', 'taltha.motter@hgv.com', '123456', 1, NULL, '4073135187', NULL, NULL, 'taltha.motter@hgv.com', 'HGV Rentals', NULL, 0, NULL, 'cus_SbISZO2XPhanDz', NULL, 'email', 'admin', NULL, '2025-01-28 00:00:00', '2025-07-01 15:12:50', NULL, 5, NULL),
(108, 'Harbour Lake Marriott - Orlando', 'info@hvlmarriott.com', '123456', 1, NULL, '4073135188', NULL, NULL, 'info@hvlmarriott.com', 'Harbour Lake Marriott - Orlando', NULL, 0, NULL, 'cus_SbISzDpevO7Y6I', NULL, 'email', 'admin', NULL, '2025-01-29 00:00:00', '2025-07-01 15:12:50', NULL, 5, NULL),
(109, 'Nick Oliver', 'Nick.oliver@vacationclub.com', '123456', 1, NULL, '4073135189', NULL, NULL, 'Nick.oliver@vacationclub.com', 'Marriott’s Royal Palms', NULL, 0, NULL, 'cus_SbISDWeGv6LNfi', NULL, 'email', 'admin', NULL, '2025-01-30 00:00:00', '2025-07-01 15:12:51', NULL, 5, NULL),
(110, 'Heidy V Castillo', 'assistant@meimgmt.com', '123456', 1, NULL, '4073135190', NULL, NULL, 'assistant@meimgmt.com', 'MEI Association', NULL, 0, NULL, 'cus_SbISZKIfJIGvwB', NULL, 'email', 'admin', NULL, '2025-01-31 00:00:00', '2025-07-01 15:12:51', NULL, NULL, NULL),
(111, 'Claudio Costa', 'claudio.costa@melia.com', '123456', 1, NULL, '4073135191', NULL, NULL, 'claudio.costa@melia.com', 'Meliá Orlando Suites Hotel', NULL, 0, NULL, 'cus_SbIShwWwsP3fuq', NULL, 'email', 'admin', NULL, '2025-02-01 00:00:00', '2025-07-01 15:12:52', NULL, 5, NULL),
(112, 'JESSICA MONROE', 'jessica.monroe@bluegreenvacations.com', '123456', 1, NULL, '4073135192', NULL, NULL, 'jessica.monroe@bluegreenvacations.com', 'MountainLoft Resort', NULL, 0, NULL, 'cus_SbISejaBWiw0Dd', NULL, 'email', 'admin', NULL, '2025-02-02 00:00:00', '2025-07-01 15:12:52', NULL, 5, NULL),
(113, 'Elizabeth', 'e796065@gmail.com', '123456', 1, NULL, '4073135193', NULL, NULL, 'e796065@gmail.com', 'Elizabeth’s Catering', NULL, 0, NULL, 'cus_SbISbs9MsSaSXc', NULL, 'email', 'admin', NULL, '2025-02-03 00:00:00', '2025-07-01 15:12:53', NULL, NULL, NULL),
(114, 'Laurel McNees', 'lovinmymunchkin@gmail.com', '123456', 1, NULL, '4073135194', NULL, NULL, 'lovinmymunchkin@gmail.com', 'Na', NULL, 0, NULL, 'cus_SbISnQGtB5Y2qP', NULL, 'email', 'admin', NULL, '2025-02-04 00:00:00', '2025-07-01 15:12:53', NULL, NULL, NULL),
(115, 'Alexandra Garfias', 'agarfias@virtuinvestments.com', '123456', 1, NULL, '4073135195', NULL, NULL, 'agarfias@virtuinvestments.com', 'North Coast', NULL, 0, NULL, 'cus_SbISYsBxHTS7MP', NULL, 'email', 'admin', NULL, '2025-02-05 00:00:00', '2025-07-01 15:12:53', NULL, NULL, NULL),
(116, 'Renee Knaus', 'renee@owcreamery.com', '123456', 1, NULL, '4073135196', NULL, NULL, 'renee@owcreamery.com', 'Old World Creamery LLC', NULL, 0, NULL, 'cus_SbIS1a3FMxcwMv', NULL, 'email', 'admin', NULL, '2025-02-06 00:00:00', '2025-07-01 15:12:54', NULL, NULL, NULL),
(117, 'Sheila Rivera', 'bruce.skwarlo@marriott.com', '123456', 1, NULL, '4073135197', NULL, NULL, 'bruce.skwarlo@marriott.com', 'Orlando Marriott Lake Mary', NULL, 0, NULL, 'cus_SbISJmbloW9zhJ', NULL, 'email', 'admin', NULL, '2025-02-07 00:00:00', '2025-07-01 15:12:54', NULL, 5, NULL),
(118, 'Miguel Corporan', 'miguel.corporan@marriott.com', '123456', 1, NULL, '4073135198', NULL, NULL, 'miguel.corporan@marriott.com', 'Orlando Marriott Lake Mary', NULL, 0, NULL, 'cus_SbISogPmoyKNFC', NULL, 'email', 'admin', NULL, '2025-02-08 00:00:00', '2025-07-01 15:12:55', NULL, 5, NULL),
(119, 'Rev', 'rev@revservices.com', '123456', 1, NULL, '4073135199', NULL, NULL, 'rev@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISbm2IITio2a', NULL, 'email', 'admin', NULL, '2025-02-09 00:00:00', '2025-07-01 15:12:55', NULL, NULL, NULL),
(120, 'Erica Chavolla', 'erica.chavolla@revservices.com', '123456', 1, NULL, '4073135200', NULL, NULL, 'erica.chavolla@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISnrKmVryT9w', NULL, 'email', 'admin', NULL, '2025-02-10 00:00:00', '2025-07-01 15:12:55', NULL, NULL, NULL),
(121, 'Joe Marsh', 'joe.marsh@revservices.com', '123456', 1, NULL, '4073135201', NULL, NULL, 'joe.marsh@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISw656NuBVjn', NULL, 'email', 'admin', NULL, '2025-02-11 00:00:00', '2025-07-01 15:12:56', NULL, NULL, NULL),
(122, 'Ashley Adebule', 'ashley.adebule@revservices.com', '123456', 1, NULL, '4073135202', NULL, NULL, 'ashley.adebule@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISzQ8OLny0jf', NULL, 'email', 'admin', NULL, '2025-02-12 00:00:00', '2025-07-01 15:12:56', NULL, 5, NULL),
(123, 'Trish Bayles', 'trish.bayles@revservices.com', '123456', 1, NULL, '4073135203', NULL, NULL, 'trish.bayles@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISz1VAltikWq', NULL, 'email', 'admin', NULL, '2025-02-13 00:00:00', '2025-07-01 15:12:57', NULL, 5, NULL),
(124, 'Kelly Schooley', 'kelly.schooley@revservices.com', '123456', 1, NULL, '4073135204', NULL, NULL, 'kelly.schooley@revservices.com', 'Rev Services', NULL, 0, NULL, 'cus_SbISVpbxvEzGjL', NULL, 'email', 'admin', NULL, '2025-02-14 00:00:00', '2025-07-01 15:12:57', NULL, NULL, NULL),
(125, 'Melinda Glazier', 'melinda.glazier@happyfeet.com', '123456', 1, NULL, '4073135205', NULL, NULL, 'melinda.glazier@happyfeet.com', 'Happy Feet Orthotics', NULL, 0, NULL, 'cus_SbIS2Q4Uy8X3gz', NULL, 'email', 'admin', NULL, '2025-02-15 00:00:00', '2025-07-01 15:12:57', NULL, NULL, NULL),
(126, 'alvin pattah', 'alvin.pattah@happyfeet.com', '123456', 1, NULL, '4073135206', NULL, NULL, 'alvin.pattah@happyfeet.com', 'Happy Feet Orthotics', NULL, 0, NULL, 'cus_SbISHGlJK2Pi1d', NULL, 'email', 'admin', NULL, '2025-02-16 00:00:00', '2025-07-01 15:12:58', NULL, NULL, NULL),
(127, 'TONY NANDWANI', 'tony.nandwani@happyfeet.com', '123456', 1, NULL, '4073135207', NULL, NULL, 'tony.nandwani@happyfeet.com', 'Happy Feet Orthotics', NULL, 0, NULL, 'cus_SbISZqCK0gU0ZG', NULL, 'email', 'admin', NULL, '2025-02-17 00:00:00', '2025-07-01 15:12:58', NULL, 5, NULL),
(128, 'Stephanie Poole', 'stephanie.poole@happyfeet.com', '123456', 1, NULL, '4073135208', NULL, NULL, 'stephanie.poole@happyfeet.com', 'Happy Feet Orthotics', NULL, 0, NULL, 'cus_SbIS8WyczG9Wrp', NULL, 'email', 'admin', NULL, '2025-02-18 00:00:00', '2025-07-01 15:12:59', NULL, 5, NULL),
(129, 'Paula Christol', 'paula.christol@happyfeet.com', '123456', 1, NULL, '4073135209', NULL, NULL, 'paula.christol@happyfeet.com', 'Happy Feet Orthotics', NULL, 0, NULL, 'cus_SbISZMy8OyDGZs', NULL, 'email', 'admin', NULL, '2025-02-19 00:00:00', '2025-07-01 15:12:59', NULL, 5, NULL),
(130, 'Jordan Crawford', 'jordan.crawford@pulte.com', '123456', 1, NULL, '4073135200', NULL, NULL, 'jordan.crawford@pulte.com', 'Pulte Group', NULL, 0, NULL, 'cus_SbISVN5WoGZfg2', NULL, 'email', 'admin', NULL, '2025-02-13 00:00:00', '2025-07-01 15:12:59', NULL, NULL, NULL),
(131, 'Jordan Crawford', 'darnisha.brown@pulte.com', '123456', 1, NULL, '4073135201', NULL, NULL, 'darnisha.brown@pulte.com', 'Pulte Homes', NULL, 0, NULL, 'cus_SbISsFPAMMrhOE', NULL, 'email', 'admin', NULL, '2025-02-13 00:00:00', '2025-07-01 15:13:00', NULL, NULL, NULL),
(132, 'Robert Miller', 'twoyou@mac.com', '123456', 1, NULL, '4173135202', NULL, NULL, 'twoyou@mac.com', 'Pest Services Inc.', NULL, 0, NULL, 'cus_SbISNkBUeaJXwh', NULL, 'email', 'admin', NULL, '2025-02-14 00:00:00', '2025-07-01 15:13:00', NULL, NULL, NULL),
(133, 'Travis Estes', 'coffeeman@revivecoffees.com', '123456', 1, NULL, '4073135203', NULL, NULL, 'coffeeman@revivecoffees.com', 'Revive Coffee', NULL, 0, NULL, 'cus_SbISLWF0PH70k7', NULL, 'email', 'admin', NULL, '2025-02-14 00:00:00', '2025-07-01 15:13:01', NULL, NULL, NULL),
(134, 'Wendy Stueck', 'px@rfsmart.com', '123456', 1, NULL, '9043135204', NULL, NULL, 'px@rfsmart.com', 'RF-SMART', NULL, 0, NULL, 'cus_SbIS4KBXRMTI6t', NULL, 'email', 'admin', NULL, '2025-02-15 00:00:00', '2025-07-01 15:13:01', NULL, NULL, NULL),
(135, 'brandon', 'bdonovan@riverandpostjax.com', '123456', 1, NULL, '9043135205', NULL, NULL, 'bdonovan@riverandpostjax.com', 'River and Post', NULL, 0, NULL, 'cus_SbISTgc6EOvpE4', NULL, 'email', 'admin', NULL, '2025-02-15 00:00:00', '2025-07-01 15:13:01', NULL, NULL, NULL),
(136, 'atom wackrow', 'atom@riverandpostjax.com', '123456', 1, NULL, '9043135206', NULL, NULL, 'atom@riverandpostjax.com', 'River and Post LLC', NULL, 0, NULL, 'cus_SbIS00Gttow2V1', NULL, 'email', 'admin', NULL, '2025-02-16 00:00:00', '2025-07-01 15:13:02', NULL, NULL, NULL),
(137, 'Holli Krusemark', 'holli@riverandpostjax.com', '123456', 1, NULL, '9043135207', NULL, NULL, 'holli@riverandpostjax.com', 'Restaurant & Rooftop Lounge', NULL, 0, NULL, 'cus_SbISoBJwfJaH52', NULL, 'email', 'admin', NULL, '2025-02-16 00:00:00', '2025-07-01 15:13:02', NULL, NULL, NULL),
(138, 'Cheri Wright', 'Cwright@scootaround.com', '123456', 1, NULL, '4073135208', NULL, NULL, 'Cwright@scootaround.com', 'Scootaround', NULL, 0, NULL, 'cus_SbISKcGTLXDkLC', NULL, 'email', 'admin', NULL, '2025-02-17 00:00:00', '2025-07-01 15:13:03', NULL, 5, NULL),
(139, 'Bruce Page', 'smokediver34@gmail.com', '123456', 1, NULL, '2283135209', NULL, NULL, 'smokediver34@gmail.com', 'Sea~n~Dipity', NULL, 0, NULL, 'cus_SbIS3hu4y6Iico', NULL, 'email', 'admin', NULL, '2025-02-17 00:00:00', '2025-07-01 15:13:03', NULL, NULL, NULL),
(140, 'DAVID DOERR', 'doerrdave@yahoo.com', '123456', 1, NULL, '(407) 670-9800', NULL, NULL, 'doerrdave@yahoo.com', 'Seminole Power Sports', NULL, 0, NULL, 'cus_SbISr799Uvgqfc', NULL, 'email', 'admin', NULL, '2022-01-26 00:00:00', '2025-07-01 15:13:04', NULL, 5, NULL),
(141, 'Chelsea Ramsey', 'Cramsey@sheratonakron.com', '123456', 1, NULL, '3304720099', NULL, NULL, 'Cramsey@sheratonakron.com', 'Sheraton', NULL, 0, NULL, 'cus_SbISr5143hCzUb', NULL, 'email', 'admin', NULL, '2023-06-18 00:00:00', '2025-07-01 15:13:04', NULL, NULL, NULL),
(142, 'Lena Warme', 'lena.warme@sheratonorlandoairport.com', '123456', 1, NULL, '407-240-5555', NULL, NULL, 'lena.warme@sheratonorlandoairport.com', 'Sheraton Suites Orlando Airport', NULL, 0, NULL, 'cus_SbISXXoFx8ASuR', NULL, 'email', 'admin', NULL, '2022-08-29 00:00:00', '2025-07-01 15:13:04', NULL, 5, NULL),
(143, 'Monica Herring', 'monica.herring@vacationclub.com', '123456', 1, NULL, '14072393789', NULL, NULL, 'monica.herring@vacationclub.com', 'Sheraton Vistana Resort', NULL, 0, NULL, 'cus_SbISOQAu5LAGxF', NULL, 'email', 'admin', NULL, '2022-03-22 00:00:00', '2025-07-01 15:13:05', NULL, 5, NULL),
(144, 'Hattzel Leyva', 'hattzel.leyva@smplsystems.com', '123456', 1, NULL, '321-430-1776', NULL, NULL, 'hattzel.leyva@smplsystems.com', 'SMPL Systems', NULL, 0, NULL, 'cus_SbIS7OMWrden38', NULL, 'email', 'admin', NULL, '2022-03-03 00:00:00', '2025-07-01 15:13:05', NULL, 5, NULL),
(145, 'Brandon Rowley', 'browley@sonatalakemary.com', '123456', 1, NULL, '3524314241', NULL, NULL, 'browley@sonatalakemary.com', 'Sonata Lake Mary', NULL, 0, NULL, 'cus_SbIS3vMAwfN5vL', NULL, 'email', 'admin', NULL, '2023-02-13 00:00:00', '2025-07-01 15:13:06', NULL, 5, NULL),
(146, 'Stephanie Johnson', 'stjohnso@southernco.com', '123456', 1, NULL, '17044719501', NULL, NULL, 'stjohnso@southernco.com', 'Southern Power Plant Cleveland', NULL, 0, NULL, 'cus_SbIS6EvCaVyGMd', NULL, 'email', 'admin', NULL, '2023-03-06 00:00:00', '2025-07-01 15:13:06', NULL, 5, NULL),
(147, 'Lisa Gufford', 'lgufford@southpointofficesuites.com', '123456', 1, NULL, '9043430633', NULL, NULL, 'lgufford@southpointofficesuites.com', 'Southpoint Office Suites', NULL, 0, NULL, 'cus_SbISNVkccbhA3n', NULL, 'email', 'admin', NULL, '2023-11-03 00:00:00', '2025-07-01 15:13:06', NULL, NULL, NULL),
(148, 'j robert dunn', 'springdalefamilyprc@sc.twcbc.com', '123456', 1, NULL, '8087961521', NULL, NULL, 'springdalefamilyprc@sc.twcbc.com', 'spingdale family practice', NULL, 0, NULL, 'cus_SbIS7bwcdgrLKy', NULL, 'email', 'admin', NULL, '2022-06-02 00:00:00', '2025-07-01 15:13:07', NULL, NULL, NULL),
(149, 'Tommy Rodriguez', 'Tommy.rodriguez@marriott.com', '123456', 1, NULL, '689-278-4008', NULL, NULL, 'Tommy.rodriguez@marriott.com', 'Springhill Suites Orlando', NULL, 0, NULL, 'cus_SbISX2ggHkeHFk', NULL, 'email', 'admin', NULL, '2024-03-04 00:00:00', '2025-07-01 15:13:07', NULL, 5, NULL),
(150, 'Angel Rodriguez', 'angel.rodriguez@royaleparcsuites.com', '123456', 1, NULL, '407-396-8040', NULL, NULL, 'angel.rodriguez@royaleparcsuites.com', 'Royale Parc Suites Orlando Royale Parc', NULL, 0, NULL, 'cus_SbISa9c4UEjZ2o', NULL, 'email', 'admin', NULL, '2023-05-30 00:00:00', '2025-07-01 15:13:08', NULL, 5, NULL),
(151, 'Matt Babbitt', 'mbabbitt@stonegategolf.com', '123456', 1, NULL, '908-372-8000', NULL, NULL, 'mbabbitt@stonegategolf.com', 'Stonegate Golf & Hospitality', NULL, 0, NULL, 'cus_SbIS58M8Hydr57', NULL, 'email', 'admin', NULL, '2022-02-15 00:00:00', '2025-07-01 15:13:08', NULL, 5, NULL),
(152, 'Beth Putnam', 'bputnam@teainc.org', '123456', 1, NULL, '9043601401', NULL, NULL, 'bputnam@teainc.org', 'TEA', NULL, 0, NULL, 'cus_SbISGeeKw1eLHN', NULL, 'email', 'admin', NULL, '2022-12-08 00:00:00', '2025-07-01 15:13:09', NULL, NULL, NULL),
(153, 'Eli Laidlaw', 'elaidlaw@thealexander.com', '123456', 1, NULL, '3176503625', NULL, NULL, 'elaidlaw@thealexander.com', 'The Alexander hotel', NULL, 0, NULL, 'cus_SbISsaQa37fUx1', NULL, 'email', 'admin', NULL, '2022-11-18 00:00:00', '2025-07-01 15:13:09', NULL, NULL, NULL),
(154, 'Beth Putnam', 'teaadmin@teainc.org', '123456', 1, NULL, '904-360-1401', NULL, NULL, 'teaadmin@teainc.org', 'The Energy Authority', NULL, 0, NULL, 'cus_SbISPP6ATknV6o', NULL, 'email', 'admin', NULL, '2022-01-19 00:00:00', '2025-07-01 15:13:09', NULL, NULL, NULL),
(155, 'Hannah Stuckey', 'hannah@thepickwickplace.com', '123456', 1, NULL, '4195620683', NULL, NULL, 'hannah@thepickwickplace.com', 'The Pickwick Place', NULL, 0, NULL, 'cus_SbISFKqT4blvMO', NULL, 'email', 'admin', NULL, '2022-05-23 00:00:00', '2025-07-01 15:13:10', NULL, NULL, NULL),
(156, 'Tanya Mann', 'tmann@plazaresortandspa.com', '123456', 1, NULL, '3863163814', NULL, NULL, 'tmann@plazaresortandspa.com', 'Plaza Resort and Spa', NULL, 0, NULL, 'cus_SbISDx7iQif7wC', NULL, 'email', 'admin', NULL, '2022-01-19 00:00:00', '2025-07-01 15:13:10', NULL, 5, NULL),
(157, 'zenaida diaz', 'zdiaz@phmemail.com', '123456', 1, NULL, '4072437212', NULL, NULL, 'zdiaz@phmemail.com', 'The Point Hotel', NULL, 0, NULL, 'cus_SbISTJVApo7RTG', NULL, 'email', 'admin', NULL, '2024-09-23 00:00:00', '2025-07-01 15:13:10', NULL, 5, NULL),
(158, 'Josh Stearns', 'jstearns@thirdmill.org', '123456', 1, NULL, '14079204780', NULL, NULL, 'jstearns@thirdmill.org', 'Millennium Ministries', NULL, 0, NULL, 'cus_SbISn5a6J9HSwL', NULL, 'email', 'admin', NULL, '2022-03-15 00:00:00', '2025-07-01 15:13:11', NULL, 5, NULL),
(159, 'Sal Zampirri', 'salzampirri@comcast.net', '123456', 1, NULL, '6094256550', NULL, NULL, 'salzampirri@comcast.net', 'Tiki Top Fire Grill', NULL, 0, NULL, 'cus_SbISrps02vV2wC', NULL, 'email', 'admin', NULL, '2024-06-21 00:00:00', '2025-07-01 15:13:11', NULL, NULL, NULL),
(160, 'Heather Todd', 'pippy08@ymail.com', '123456', 1, NULL, '4073135280', NULL, NULL, 'pippy08@ymail.com', 'Pippy Productions', NULL, 0, NULL, 'cus_SbISqqoTNfaDwt', NULL, 'email', 'admin', NULL, '2024-01-01 00:00:00', '2025-07-01 15:13:12', NULL, NULL, NULL),
(161, 'Tom Batchelor', 'batchelortom2002@yahoo.com', '123456', 1, NULL, '4073135281', NULL, NULL, 'batchelortom2002@yahoo.com', 'Batchelor Consulting', NULL, 0, NULL, 'cus_SbISgRCQ9LGqeN', NULL, 'email', 'admin', NULL, '2024-01-02 00:00:00', '2025-07-01 15:13:12', NULL, NULL, NULL),
(162, 'Mark Lawrence', 'mark.lawrence2@asurion.com', '123456', 1, NULL, '4073135282', NULL, NULL, 'mark.lawrence2@asurion.com', 'UBREAKIFIX', NULL, 0, NULL, 'cus_SbISyAhe7LYMis', NULL, 'email', 'admin', NULL, '2024-01-03 00:00:00', '2025-07-01 15:13:12', NULL, 5, NULL),
(163, 'Laurie Pullen', 'laurie.pullen@umm.edu', '123456', 1, NULL, '4073135283', NULL, NULL, 'laurie.pullen@umm.edu', 'UM BWMC', NULL, 0, NULL, 'cus_SbISCkg08kIFtv', NULL, 'email', 'admin', NULL, '2024-01-04 00:00:00', '2025-07-01 15:13:13', NULL, NULL, NULL),
(164, 'CAMILLA D MACHADO', 'camilla@unimacmanagement.com', '123456', 1, NULL, '4073135284', NULL, NULL, 'camilla@unimacmanagement.com', 'Unimac Management LLC', NULL, 0, NULL, 'cus_SbISJ4KfgFAhZS', NULL, 'email', 'admin', NULL, '2024-01-05 00:00:00', '2025-07-01 15:13:13', NULL, 5, NULL),
(165, 'Eric Waters', 'ericwaters97@yahoo.com', '123456', 1, NULL, '4073135285', NULL, NULL, 'ericwaters97@yahoo.com', 'USPS', NULL, 0, NULL, 'cus_SbISrBpu39lEEP', NULL, 'email', 'admin', NULL, '2024-01-06 00:00:00', '2025-07-01 15:13:14', NULL, NULL, NULL),
(166, 'Gregory Truvillion', 'gregory.truvillion@fsresidential.com', '123456', 1, NULL, '4073135286', NULL, NULL, 'gregory.truvillion@fsresidential.com', 'FS Residential', NULL, 0, NULL, 'cus_SbISGltT2wwzhV', NULL, 'email', 'admin', NULL, '2024-01-07 00:00:00', '2025-07-01 15:13:14', NULL, 5, NULL),
(167, 'DAVID E MAXON', 'kma.watertown@gmail.com', '123456', 1, NULL, '4073135287', NULL, NULL, 'kma.watertown@gmail.com', 'Watertown Cafe LLC / Kiss My Axe', NULL, 0, NULL, 'cus_SbISrgFOA2qXDk', NULL, 'email', 'admin', NULL, '2024-01-08 00:00:00', '2025-07-01 15:13:14', NULL, 5, NULL),
(168, 'Jeffrey Ward', 'jeff.ward@wcs-llc.com', '123456', 1, NULL, '4073135288', NULL, NULL, 'jeff.ward@wcs-llc.com', 'Ward Consulting Services', NULL, 0, NULL, 'cus_SbISCUOIeAwYBR', NULL, 'email', 'admin', NULL, '2024-01-09 00:00:00', '2025-07-01 15:13:15', NULL, NULL, NULL),
(169, 'Melanie Ferrara', 'mferrara@waterstonemortgage.com', '123456', 1, NULL, '4073135289', NULL, NULL, 'mferrara@waterstonemortgage.com', 'Waterstone Mortgage', NULL, 0, NULL, 'cus_SbISMQBpr2ZraP', NULL, 'email', 'admin', NULL, '2024-01-10 00:00:00', '2025-07-01 15:13:15', NULL, 5, NULL),
(170, 'webbmortuaryandremovalservice', 'webb.mortuaryandremovalservice@gmail.com', '123456', 1, NULL, '4073135290', NULL, NULL, 'webb.mortuaryandremovalservice@gmail.com', 'Webb Mortuary and Removal Service', NULL, 0, NULL, 'cus_SbIS08TV6eh3Qx', NULL, 'email', 'admin', NULL, '2024-01-11 00:00:00', '2025-07-01 15:13:16', NULL, NULL, NULL),
(171, 'Patricia', 'patricia_decesare@wgresorts.com', '123456', 1, NULL, '4073135291', NULL, NULL, 'patricia_decesare@wgresorts.com', 'Wyndham Grand Orlando Resort - Villas & Town Center', NULL, 0, NULL, 'cus_SbISjgaytin22u', NULL, 'email', 'admin', NULL, '2024-01-12 00:00:00', '2025-07-01 15:13:16', NULL, 5, NULL),
(172, 'Eva Eberle', 'eva_eberle@wgresorts.com', '123456', 1, NULL, '4073135292', NULL, NULL, 'eva_eberle@wgresorts.com', 'Wyndham Grand Orlando Resort Central Laundry', NULL, 0, NULL, 'cus_SbISG8ll8qlbLm', NULL, 'email', 'admin', NULL, '2024-01-13 00:00:00', '2025-07-01 15:13:16', NULL, 5, NULL),
(173, 'Bayron Lopez', 'Bayron.lopez@westinlakemary.com', '123456', 1, NULL, '4073135293', NULL, NULL, 'Bayron.lopez@westinlakemary.com', 'Westin Lake Mary', NULL, 0, NULL, 'cus_SbISs8CjTdMJHi', NULL, 'email', 'admin', NULL, '2024-01-14 00:00:00', '2025-07-01 15:13:17', NULL, 5, NULL),
(174, 'Stacy Davis', 'Sdavis@wvwl.org', '123456', 1, NULL, '4073135294', NULL, NULL, 'Sdavis@wvwl.org', 'Westminster Village', NULL, 0, NULL, 'cus_SbISJ4kXdfQYVn', NULL, 'email', 'admin', NULL, '2024-01-15 00:00:00', '2025-07-01 15:13:17', NULL, 5, NULL),
(175, 'kendall jamison', 'kendall.jamison@whiting-turner.com', '123456', 1, NULL, '4073135295', NULL, NULL, 'kendall.jamison@whiting-turner.com', 'Whiting Turner', NULL, 0, NULL, 'cus_SbISsz2v0dvZ34', NULL, 'email', 'admin', NULL, '2024-01-16 00:00:00', '2025-07-01 15:13:18', NULL, NULL, NULL),
(176, 'Becca Sanchez', 'becca@cheneylimestone.com', '123456', 1, NULL, '4073135296', NULL, NULL, 'becca@cheneylimestone.com', 'Williamston Admiral 181', NULL, 0, NULL, 'cus_SbISIMh8yQLEzd', NULL, 'email', 'admin', NULL, '2024-01-17 00:00:00', '2025-07-01 15:13:18', NULL, NULL, NULL),
(177, 'Calvin Flemming', 'agm@wintersbeachclub.com', '123456', 1, NULL, '4073135297', NULL, NULL, 'agm@wintersbeachclub.com', 'The Dolphin Beach Club', NULL, 0, NULL, 'cus_SbISPpNevrzEBX', NULL, 'email', 'admin', NULL, '2024-01-18 00:00:00', '2025-07-01 15:13:19', NULL, 5, NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password`, `status`, `image`, `phoneNumber`, `countryCode`, `saleTaxNumber`, `emailToSendInvoices`, `companyName`, `latestOtp`, `deleted`, `verifiedAt`, `stripeCustomerId`, `defaultPaymentMethod`, `registerBy`, `createdBy`, `preferredPaymentMethod`, `createdAt`, `updatedAt`, `deletedAt`, `salesRepId`, `billingAddress`) VALUES
(178, 'Victor Jose Layug', 'victorjose.layug@wyn.com', '123456', 1, NULL, '4073135298', NULL, NULL, 'victorjose.layug@wyn.com', 'Wyndham Kingstown Reef', NULL, 0, NULL, 'cus_SbIS8X896Bh4sD', NULL, 'email', 'admin', NULL, '2024-01-19 00:00:00', '2025-07-01 15:13:19', NULL, 5, NULL),
(179, 'Roxanne Mussolino', 'Bonnetcreekap@wyn.com', '123456', 1, NULL, '4073135299', NULL, NULL, 'Bonnetcreekap@wyn.com', 'Wyndham Bonnet Creek - Sales Floor', NULL, 0, NULL, 'cus_SbISaWWqMndqs0', NULL, 'email', 'admin', NULL, '2024-01-20 00:00:00', '2025-07-01 15:13:19', NULL, 5, NULL),
(180, 'agustin sosa', 'asosa@wyndhamcelebration.com', '123456', 1, NULL, '4073967476', NULL, NULL, 'asosa@wyndhamcelebration.com', 'Wyndham Celebration', NULL, 0, NULL, 'cus_SbIS62fYRcqgls', NULL, 'email', 'admin', NULL, '2024-02-01 00:00:00', '2025-07-01 15:13:20', NULL, 5, NULL),
(181, 'Roxanne Mussolino', 'thepackap@wyn.com', '123456', 1, NULL, '4073967477', NULL, NULL, 'thepackap@wyn.com', 'Wyndham Cypress', NULL, 0, NULL, 'cus_SbITdQv9sPgtIg', NULL, 'email', 'admin', NULL, '2024-02-02 00:00:00', '2025-07-01 15:13:20', NULL, 5, NULL),
(182, 'David Brannigan', 'Sdentino@wyndhamlbv.com', '123456', 1, NULL, '4073967478', NULL, NULL, 'Sdentino@wyndhamlbv.com', 'Wyndham LBV', NULL, 0, NULL, 'cus_SbITtyXNc2Fp6O', NULL, 'email', 'admin', NULL, '2024-02-03 00:00:00', '2025-07-01 15:13:21', NULL, 5, NULL),
(183, 'Arsheena Khan', 'Hr@xeniareit.com', '123456', 1, NULL, '4073967479', NULL, NULL, 'Hr@xeniareit.com', 'Xenia Hotels & Resorts, Inc.', NULL, 0, NULL, 'cus_SbITJsISwlHFQo', NULL, 'email', 'admin', NULL, '2024-02-04 00:00:00', '2025-07-01 15:13:21', NULL, 5, NULL),
(184, 'drichards19', 'drichards@yuengling.com', '123456', 1, NULL, '8566862222', NULL, NULL, 'drichards@yuengling.com', 'Yuengling Draft Haus & Kitchen', NULL, 0, NULL, 'cus_SbITBi7IDt5Wde', NULL, 'email', 'admin', NULL, '2024-02-05 00:00:00', '2025-07-01 15:13:21', NULL, NULL, NULL),
(185, 'User test 1', 'sigidevelopers@gmail.com', '123456', 1, NULL, '3089078990', '+92', '', 'sigidevelopers@gmail.com', 'Demo company florida', 3050, 0, '2025-07-03 06:26:27', 'cus_SbuQDDCxxUKQiH', NULL, 'email', 'sales-rep', NULL, '2025-07-03 06:26:27', '2025-07-04 08:18:42', NULL, 5, NULL),
(186, 'Test Customer', 'travis@busybeancoffee.com', '123456', 1, NULL, '4073134650', NULL, NULL, 'sigidevelopers@gmail.com', 'Coco Key Hotel', 3618, 0, NULL, 'cus_Sc0iBoYZlor8Vi', NULL, 'email', 'admin', NULL, '2022-01-26 00:00:00', '2025-07-11 06:51:13', NULL, 5, NULL),
(188, 'manager kkkkk', 'zeeshannawaz392@gmail.com', 'Sigi123.@', 1, NULL, '030303030303', '+1', 'ds223', 'sigidevelopers@gmail.com', 'gf', NULL, 0, '2025-07-03 13:56:32', 'cus_Sc1gjCUUmWxAWk', NULL, 'email', 'sales-rep', NULL, '2025-07-03 13:56:32', '2025-07-03 13:56:33', NULL, 5, NULL),
(190, 'Azhar', 'zeeshannawaz331@gmail.com', 'Sigi123.@', 1, NULL, '5', '+1', 'ergz', 'zeeshannawaz393@gmail.com', 'retryu', NULL, 0, '2025-07-03 14:35:52', 'cus_Sc2JJvwaKt8jMi', NULL, 'email', 'sales-rep', NULL, '2025-07-03 14:35:52', '2025-07-03 14:35:52', NULL, 5, NULL),
(191, 'Sigi_9', 'engrshahnawazch@gmail.com', 'Sigi123.@', 1, NULL, '03030045309', '+1', 'da', 'asdf@gmail.com', 'New', NULL, 0, '2025-07-03 14:52:06', 'cus_Sc2ZLev920CspQ', NULL, 'email', 'sales-rep', NULL, '2025-07-03 14:52:06', '2025-07-03 14:52:07', NULL, 5, NULL),
(195, 'Travis Estes', 'ap@busybeancoffee.com', 'Coffee123!', 1, NULL, '6172793686', '+1', '', 'travise211@gmail.com', 'Bills Coffee Supply', NULL, 0, '2025-07-03 16:22:55', 'cus_Sc42Qo3sc5QQVr', NULL, 'email', 'sales-rep', NULL, '2025-07-03 16:22:55', '2025-07-03 16:22:55', NULL, 5, NULL),
(196, 'Zeeshan Nawaz', 'zeeshannawaz393@gmail.com', '12345qwE@', 1, NULL, '02089303087', '+1', '', 'engrshahnawazch@gmail.com', 'Allfor care Services Ltd.', 8941, 0, '2025-07-04 08:23:29', 'cus_ScJXXvsxCPXSbE', NULL, 'email', 'sales-rep', NULL, '2025-07-04 08:23:29', '2025-07-15 13:02:53', NULL, 5, NULL),
(197, 'Zeeshan Nawaz', 'wickj6276@gmail.com', 'Sigi123.@', 1, NULL, '1 34567890', NULL, '', 'engrshahnawazch@gmail.com', 'tryu', 3782, 0, '2025-07-04 13:52:32', 'cus_ScOpY1IQrQas6m', NULL, 'email', 'registration', NULL, '2025-07-04 13:51:24', '2025-07-04 13:52:32', NULL, 5, NULL),
(198, 'Noor', 'noorfatimahamid912@gmail.com', 'PASSWORD_123a', 1, NULL, '+92 3078967556', NULL, '', 'noorfatimahamid912@gmail.com', 'alpha cafe', 6202, 0, '2025-07-07 09:35:51', 'cus_SdSMTIi2Pa19S6', NULL, 'email', 'registration', NULL, '2025-07-07 09:34:24', '2025-07-17 10:59:46', NULL, 5, NULL),
(199, 'Travis Estes', 'traviise211@gmail.com', 'Coffeebean2025!', 1, NULL, '6172793686', '+1', '', 'travise211@gmail.com', 'Busy Bean Coffee', NULL, 0, '2025-07-07 17:20:50', 'cus_SdZsVvlbNlZdio', NULL, 'email', 'sales-rep', NULL, '2025-07-07 17:20:50', '2025-07-07 17:20:50', NULL, 10, NULL),
(200, 'Sheila Rivera', 'kin.lai@marriott.com', 'PASSWORD_123a', 1, NULL, '4079951100', '+1', '.', 'theresa.davis@marriott.com', 'Orlando Marriott Lake Mary', NULL, 0, '2025-07-14 11:15:23', 'cus_Sg6ZVqPUwovwX9', NULL, 'email', 'sales-rep', NULL, '2025-07-14 11:15:23', '2025-07-14 11:15:23', NULL, 5, NULL),
(201, 'Nadia Mahmoud', 'Nadia.mahmoud@vacationclub.com', 'PASSWORD_123a', 1, NULL, '4074656116', '+1', '', 'Nadia.mahmoud@vacationclub.com', 'Marriott\'s Harbour Lake', NULL, 0, '2025-07-16 06:13:06', 'cus_Sgm8p7xhw5yuZk', NULL, 'email', 'sales-rep', NULL, '2025-07-16 06:13:06', '2025-07-16 06:13:06', NULL, 5, NULL),
(202, 'Ashley Adebule', 'aadebule@park-royalhotels.com', 'PASSWORD_123a', 1, NULL, '4074834901', '+1', '', 'aadebule@park-royalhotels.com', 'Park Royal', NULL, 0, '2025-07-16 06:54:38', 'cus_SgmorNbG8AhKwj', NULL, 'email', 'sales-rep', NULL, '2025-07-16 06:54:38', '2025-07-16 06:54:38', NULL, 5, NULL),
(203, 'Paula Christol', 'paula.christol@loewshotels.com', 'PASSWORD_123a', 1, NULL, '4075031004', '+1', '', 'apinvoice@loewshotels.com', 'Portofino Bay', NULL, 0, '2025-07-16 10:12:40', 'cus_Sgq0EUjCHioRYT', NULL, 'email', 'sales-rep', NULL, '2025-07-16 10:12:40', '2025-07-16 10:12:41', NULL, 5, NULL),
(204, 'Rod Valencia', 'chefrod.valencia@hilton.com', 'PASSWORD_123a', 1, NULL, '4074329194', '+1', '', 'chefrod.valencia@hilton.com', 'Hilton Melbourne Beach', NULL, 0, '2025-07-16 11:09:47', 'cus_SgqvrAmb76Fczv', NULL, 'email', 'sales-rep', NULL, '2025-07-16 11:09:47', '2025-07-16 11:09:48', NULL, 5, NULL),
(205, 'Nickolette Fernandez', 'nickolette.fernandez@loewshotels.com', 'Coffee4321!', 1, NULL, '4075033150', '+1', '', 'apinvoice@loewshotels.com', 'LOEWS ROYAL PACIFIC RESORT', NULL, 0, '2025-07-16 15:19:07', 'cus_SguwsoVHTbcJ9D', NULL, 'email', 'sales-rep', NULL, '2025-07-16 15:19:07', '2025-07-16 15:19:07', NULL, 5, NULL),
(206, 'Azhar\'s User', 'azhar@gmail.com', 'Azhar123.@', 1, NULL, '03030045309', '+1', 'ds223', 'Azhar@invoice.com', 'Azhar Company Details', NULL, 0, '2025-07-17 08:04:17', 'cus_ShB9HHXqFEhvbQ', NULL, 'email', 'sales-rep', NULL, '2025-07-17 08:04:17', '2025-07-17 08:04:18', NULL, 5, NULL),
(207, 'Azhar', 'user14@gmail.com', 'Azhar123.@', 1, NULL, '03030045309', '+1', 'ccc', 'ccc@cc.com', 'ccc', NULL, 0, '2025-07-17 11:12:25', 'cus_ShECDx0vV81n18', NULL, 'email', 'sales-rep', NULL, '2025-07-17 11:12:25', '2025-07-17 11:12:26', NULL, 5, NULL),
(209, 'Azhar', 'user12@gmail.com', 'Azhar123.@', 1, NULL, '03030045309', '+1', 'jjj', 'jj@jj.com', 'jjj', NULL, 0, '2025-07-17 11:15:57', 'cus_ShEF9nSJJGqcdR', NULL, 'email', 'sales-rep', NULL, '2025-07-17 11:15:57', '2025-07-17 11:15:58', NULL, 5, NULL),
(212, 'Travis Estes', 'coffeeman211@gmail.com', 'Coffee123456!', 1, NULL, '6172793686', '+1', '', 'coffeeman@revivecoffees.com', 'Ruthless Coffee', NULL, 0, '2025-07-17 15:12:51', 'cus_ShI4Ha7ftRX0oH', NULL, 'email', 'sales-rep', NULL, '2025-07-17 15:12:51', '2025-07-18 06:15:21', NULL, 10, NULL),
(213, 'Ashley Adebule', 'vbryant@park-royalhotels.com', 'Coffeebeans1!', 1, NULL, '4074834901', '+1', '', 'aadebule@park-royalhotels.com', 'PARK ROYAL', NULL, 0, '2025-07-18 01:44:57', 'cus_ShSGPTHdzudPTb', NULL, 'email', 'sales-rep', NULL, '2025-07-18 01:44:57', '2025-07-21 07:07:25', NULL, 10, NULL),
(220, 'Bill Jones', 'travis_e@yahoo.com', 'Coffee123456!', 1, NULL, '8338432326', '+1', '', 'travis_e@yahoo.com', 'Busy Bean Coffee, Inc', NULL, 0, '2025-07-18 17:37:28', 'cus_ShhddA2BaQNDsD', NULL, 'email', 'sales-rep', NULL, '2025-07-18 17:37:28', '2025-07-21 09:38:27', NULL, 10, NULL),
(225, 'Monica Estes', 'thecoffeeman211@gmail.com', 'Iloveteeth!1', 1, NULL, '6172793686', '+1', '', 'thecoffeeman211@gmail.com', 'INNOVATIVE ENDODONTICS', NULL, 0, '2025-07-21 17:36:26', 'cus_SipI5bnZ1xyxNE', NULL, 'email', 'sales-rep', NULL, '2025-07-21 17:36:26', '2025-07-21 17:36:26', NULL, 10, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `zone`
--

CREATE TABLE `zone` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `coordinates` polygon DEFAULT NULL,
  `status` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `deletedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounts_email_unique` (`email`),
  ADD KEY `email_index` (`email`);

--
-- Indexes for table `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `town_index` (`town`),
  ADD KEY `cityInSystemId` (`cityInSystemId`),
  ADD KEY `countryInSystemId` (`countryInSystemId`),
  ADD KEY `stateInSystemId` (`stateInSystemId`),
  ADD KEY `territoryId` (`territoryId`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `billingAddresses`
--
ALTER TABLE `billingAddresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `town_index` (`town`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`);

--
-- Indexes for table `chequeDetails`
--
ALTER TABLE `chequeDetails`
  ADD PRIMARY KEY (`id`),
  ADD KEY `checkNumber_index` (`chequeNumber`),
  ADD KEY `bankName_index` (`bankName`),
  ADD KEY `orderId` (`orderId`);

--
-- Indexes for table `cityInSystems`
--
ALTER TABLE `cityInSystems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`),
  ADD KEY `countryInSystemId` (`countryInSystemId`),
  ADD KEY `stateInSystemId` (`stateInSystemId`),
  ADD KEY `territoryId` (`territoryId`);

--
-- Indexes for table `countryInSystems`
--
ALTER TABLE `countryInSystems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `categoryId` (`categoryId`),
  ADD KEY `orderId` (`orderId`),
  ADD KEY `orderFrequencyId` (`orderFrequencyId`),
  ADD KEY `productId` (`productId`);

--
-- Indexes for table `orderFrequencies`
--
ALTER TABLE `orderFrequencies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `frequency_index` (`frequency`),
  ADD KEY `addressId` (`addressId`),
  ADD KEY `orderId` (`orderId`),
  ADD KEY `salesRepId` (`salesRepId`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `orderHistories`
--
ALTER TABLE `orderHistories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orderHistories_index` (`orderStatus`),
  ADD KEY `orderId` (`orderId`),
  ADD KEY `statusId` (`statusId`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `addressId` (`addressId`),
  ADD KEY `orderFrequencyId` (`orderFrequencyId`),
  ADD KEY `salesRepId` (`salesRepId`),
  ADD KEY `statusId` (`statusId`),
  ADD KEY `supplierId` (`supplierId`),
  ADD KEY `userId` (`userId`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`),
  ADD KEY `categoryId` (`categoryId`);

--
-- Indexes for table `salesFromPatners`
--
ALTER TABLE `salesFromPatners`
  ADD PRIMARY KEY (`id`),
  ADD KEY `salesRepId` (`salesRepId`);

--
-- Indexes for table `salesReps`
--
ALTER TABLE `salesReps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salesReps_email_unique` (`email`),
  ADD KEY `email_index` (`email`);

--
-- Indexes for table `shippingCompanies`
--
ALTER TABLE `shippingCompanies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_index` (`company`);

--
-- Indexes for table `stateInSystems`
--
ALTER TABLE `stateInSystems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`),
  ADD KEY `countryInSystemId` (`countryInSystemId`),
  ADD KEY `salesRepId` (`salesRepId`);

--
-- Indexes for table `statuses`
--
ALTER TABLE `statuses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orderStatus_index` (`orderStatus`);

--
-- Indexes for table `supplier`
--
ALTER TABLE `supplier`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `supplier_email_unique` (`email`),
  ADD KEY `email_index` (`email`);

--
-- Indexes for table `territories`
--
ALTER TABLE `territories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`),
  ADD KEY `countryInSystemId` (`countryInSystemId`),
  ADD KEY `stateInSystemId` (`stateInSystemId`);

--
-- Indexes for table `transfersToSalesReps`
--
ALTER TABLE `transfersToSalesReps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orderId` (`orderId`),
  ADD KEY `salesRepId` (`salesRepId`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD KEY `email_index` (`email`),
  ADD KEY `salesRepId` (`salesRepId`);

--
-- Indexes for table `zone`
--
ALTER TABLE `zone`
  ADD PRIMARY KEY (`id`),
  ADD KEY `name_index` (`name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `addresses`
--
ALTER TABLE `addresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=368;

--
-- AUTO_INCREMENT for table `billingAddresses`
--
ALTER TABLE `billingAddresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=362;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `chequeDetails`
--
ALTER TABLE `chequeDetails`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `cityInSystems`
--
ALTER TABLE `cityInSystems`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1077;

--
-- AUTO_INCREMENT for table `countryInSystems`
--
ALTER TABLE `countryInSystems`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=249;

--
-- AUTO_INCREMENT for table `orderFrequencies`
--
ALTER TABLE `orderFrequencies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=116;

--
-- AUTO_INCREMENT for table `orderHistories`
--
ALTER TABLE `orderHistories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=337;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=132;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `salesFromPatners`
--
ALTER TABLE `salesFromPatners`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `salesReps`
--
ALTER TABLE `salesReps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `shippingCompanies`
--
ALTER TABLE `shippingCompanies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=768;

--
-- AUTO_INCREMENT for table `stateInSystems`
--
ALTER TABLE `stateInSystems`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `statuses`
--
ALTER TABLE `statuses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `supplier`
--
ALTER TABLE `supplier`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `territories`
--
ALTER TABLE `territories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transfersToSalesReps`
--
ALTER TABLE `transfersToSalesReps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=226;

--
-- AUTO_INCREMENT for table `zone`
--
ALTER TABLE `zone`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `addresses`
--
ALTER TABLE `addresses`
  ADD CONSTRAINT `addresses_ibfk_193` FOREIGN KEY (`cityInSystemId`) REFERENCES `cityInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `addresses_ibfk_194` FOREIGN KEY (`countryInSystemId`) REFERENCES `countryInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `addresses_ibfk_195` FOREIGN KEY (`stateInSystemId`) REFERENCES `stateInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `addresses_ibfk_196` FOREIGN KEY (`territoryId`) REFERENCES `territories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `addresses_ibfk_197` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `billingAddresses`
--
ALTER TABLE `billingAddresses`
  ADD CONSTRAINT `billingAddresses_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `chequeDetails`
--
ALTER TABLE `chequeDetails`
  ADD CONSTRAINT `chequeDetails_ibfk_1` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `cityInSystems`
--
ALTER TABLE `cityInSystems`
  ADD CONSTRAINT `cityInSystems_ibfk_115` FOREIGN KEY (`countryInSystemId`) REFERENCES `countryInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `cityInSystems_ibfk_116` FOREIGN KEY (`stateInSystemId`) REFERENCES `stateInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `cityInSystems_ibfk_117` FOREIGN KEY (`territoryId`) REFERENCES `territories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `items_ibfk_153` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `items_ibfk_154` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `items_ibfk_155` FOREIGN KEY (`orderFrequencyId`) REFERENCES `orderFrequencies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `items_ibfk_156` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `orderFrequencies`
--
ALTER TABLE `orderFrequencies`
  ADD CONSTRAINT `orderFrequencies_ibfk_153` FOREIGN KEY (`addressId`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orderFrequencies_ibfk_154` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orderFrequencies_ibfk_155` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orderFrequencies_ibfk_156` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `orderHistories`
--
ALTER TABLE `orderHistories`
  ADD CONSTRAINT `orderHistories_ibfk_77` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orderHistories_ibfk_78` FOREIGN KEY (`statusId`) REFERENCES `statuses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_229` FOREIGN KEY (`addressId`) REFERENCES `addresses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_ibfk_230` FOREIGN KEY (`orderFrequencyId`) REFERENCES `orderFrequencies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_ibfk_231` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_ibfk_232` FOREIGN KEY (`statusId`) REFERENCES `statuses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_ibfk_233` FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_ibfk_234` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `salesFromPatners`
--
ALTER TABLE `salesFromPatners`
  ADD CONSTRAINT `salesFromPatners_ibfk_1` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `stateInSystems`
--
ALTER TABLE `stateInSystems`
  ADD CONSTRAINT `stateInSystems_ibfk_77` FOREIGN KEY (`countryInSystemId`) REFERENCES `countryInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stateInSystems_ibfk_78` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `territories`
--
ALTER TABLE `territories`
  ADD CONSTRAINT `territories_ibfk_73` FOREIGN KEY (`countryInSystemId`) REFERENCES `countryInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `territories_ibfk_74` FOREIGN KEY (`stateInSystemId`) REFERENCES `stateInSystems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `transfersToSalesReps`
--
ALTER TABLE `transfersToSalesReps`
  ADD CONSTRAINT `transfersToSalesReps_ibfk_73` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `transfersToSalesReps_ibfk_74` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`salesRepId`) REFERENCES `salesReps` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
