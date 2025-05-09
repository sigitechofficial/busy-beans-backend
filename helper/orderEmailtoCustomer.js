const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })

const { attachments } = require('./attactments')
const attachment = attachments()
const { transporter } = require('./transpoter')
const { footer } = require('./footer')

module.exports = function ({ data, satge = 'Confirmed'}) {
  console.log('🚀 ~ data:', data)
  let firstParagraph = `${data.content}`

  let hiCustomer = `Hi ${data?.order?.name}!`
 

 
  // transporter.sendMail(
  //   {
  //     from: process.env.EMAIL_USERNAME, // sender address
  //     to: ['sigidevelopers@gmail.com', `${data.email}`], // list of receivers
  //     subject: subject, // Subject line
  //     attachments: attachment.footer.concat(attachment.trim),
  //     html: `

  //     <!DOCTYPE html>
  //     <html lang="en">
  //       <head>
  //         <meta charset="UTF-8" />
  //         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  //         <link rel="preconnect" href="https://fonts.googleapis.com" />
  //         <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  //         <link
  //           href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&display=swap"
  //           rel="stylesheet"
  //         />
  //         <title>Welcome to Busy Bean</title>
  //       </head>
  //       <body
  //         style="
  //           margin: 0;
  //           padding: 10px 0px;
  //           font-family: Arial, sans-serif;
  //           background-color: #f8f8f8;
  //         "
  //       >
  //         <table
  //           align="center"
  //           border="0"
  //           cellpadding="0"
  //           cellspacing="0"
  //           width="100%"
  //           style="border-collapse: collapse; max-width: 600px"
  //         >
  //           <tr>
  //             <td align="center" style="padding: 20px 0">
  //               <img
  //                 src="./images/logo.png"
  //                 alt="Image"
  //                 width="316"
  //                 height="147"
  //                 style="border-radius: 16px"
  //               />
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: #000000;
  //                 font-size: 24px;
  //                 font-weight: bold;
  //                 line-height: 1.5;
  //               "
  //             >
  //               ${hiCustomer}
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               Thank you for your order!
  //             </td>
  //           </tr>
  //           <tr align="center">
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 20px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               <span style="font-weight: 600; font-size: larger"
  //                 >Order Status:
  //               </span>
  //               <span
  //                 style="
  //                   font-weight: bold;
  //                   color: #322a23;
  //                   background-color: #86644c;
  //                   padding: 10px 10px;
  //                   border-radius: 60px;
  //                 "
  //                 >Confirmed</span
  //               >
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 20px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               <span style="font-weight: 600; font-size: large">Order Note:</span>
  //               <br />
  //               Your order has been confirmed and will be prepared according to the
  //               instructions.
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               align="center"
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 10px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               <span style="font-weight: bold">Order No:</span>
  //               <span style="font-weight: bold; color: #86644c">333526454</span><br />
  //               <span style="font-weight: bold">Payment method: </span>Visa Card<br />
  //               Order Date: 02/02/2025
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 20px;
  //                 font-family: 'Chivo', sans-serif;
  //                 font-weight: bold;
  //                 font-size: 18px;
  //                 color: #000000;
  //               "
  //             >
  //               Order Details
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 10px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               <table
  //                 width="100%"
  //                 cellspacing="0"
  //                 cellpadding="5"
  //                 style="border: 1px solid #d9d9d9; margin-top: 10px"
  //               >
  //                 <tr>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                     "
  //                   >
  //                     2x Whole Coffee Bean
  //                   </td>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       text-align: right;
  //                     "
  //                   >
  //                     $220.00
  //                   </td>
  //                 </tr>
  //                 <tr>
  //                   <td
  //                     align="end"
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       font-weight: bold;
  //                     "
  //                   >
  //                     Sub Total:
  //                   </td>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       text-align: right;
  //                     "
  //                   >
  //                     $220.00
  //                   </td>
  //                 </tr>
  //                 <tr>
  //                   <td
  //                     align="end"
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                     "
  //                   >
  //                     Discount:
  //                   </td>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       text-align: right;
  //                     "
  //                   >
  //                     $0.00
  //                   </td>
  //                 </tr>
  //                 <tr>
  //                   <td
  //                     align="end"
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                     "
  //                   >
  //                     Shipping Charges:
  //                   </td>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       text-align: right;
  //                     "
  //                   >
  //                     $0.00
  //                   </td>
  //                 </tr>
  //                 <tr>
  //                   <td
  //                     align="end"
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       font-weight: bold;
  //                       color: rgba(0, 0, 0, 0.8);
  //                     "
  //                   >
  //                     Total:
  //                   </td>
  //                   <td
  //                     style="
  //                       font-family: 'Chivo', sans-serif;
  //                       font-size: 16px;
  //                       font-weight: bold;
  //                       color: rgba(0, 0, 0, 0.8);
  //                       text-align: right;
  //                     "
  //                   >
  //                     $220.00
  //                   </td>
  //                 </tr>
  //               </table>
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 20px;
  //                 font-family: 'Chivo', sans-serif;
  //                 color: rgba(0, 0, 0, 0.8);
  //                 font-size: 16px;
  //                 line-height: 1.5;
  //               "
  //             >
  //               If you have any questions, feel free to reach out to our support team.
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-top: 40px;
  //                 font-family: 'Switzer', sans-serif;
  //                 font-weight: 600;
  //                 font-size: 16px;
  //                 text-align: center;
  //               "
  //             >
  //               Follow Us
  //             </td>
  //           </tr>
  //           <tr>
  //             <td style="padding-top: 10px; text-align: center">
  //               <table
  //                 align="center"
  //                 border="0"
  //                 cellpadding="0"
  //                 cellspacing="0"
  //                 style="margin: 0 auto"
  //               >
  //                 <tr>
  //                   <td style="padding: 4px">
  //                     <a
  //                       href="https://www.linkedin.com/checkpoint/challenge/AgGemLghDZDAvwAAAZZXx5mhuM_Z6hihtn5wJCupcQtu2NPkTH_NH2cwAnPoZSkoY4N9CAtCy0y2JnSwIHU-rnt16C3qeg?ut=20AJubvzyRRrI1"
  //                       target="_blank"
  //                       ><img
  //                         src="cid:linkedin"
  //                         alt="LinkedIn"
  //                         style="width: 32px; height: 32px; display: block"
  //                     /></a>
  //                   </td>
  //                   <td style="padding: 4px">
  //                     <a
  //                       href="https://www.facebook.com/busybeancoffeeinc/"
  //                       target="_blank"
  //                       ><img
  //                         src="./images/facebook.webp"
  //                         alt="Facebook"
  //                         style="width: 32px; height: 32px; display: block"
  //                     /></a>
  //                   </td>
  //                   <td style="padding: 4px">
  //                     <a href="https://twitter.com/busybean_coffee" target="_blank"
  //                       ><img
  //                         src="./images/twitter.webp"
  //                         alt="Twitter"
  //                         style="width: 32px; height: 32px; display: block"
  //                     /></a>
  //                   </td>
  //                   <td style="padding: 4px">
  //                     <a
  //                       href="https://www.instagram.com/accounts/login/?next=%2Fbusybean_coffee%2F&source=omni_redirect"
  //                       target="_blank"
  //                       ><img
  //                         src="./images/instagram.webp"
  //                         alt="Instagram"
  //                         style="width: 32px; height: 32px; display: block"
  //                     /></a>
  //                   </td>
  //                 </tr>
  //               </table>
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 20px;
  //                 font-family: 'Switzer', sans-serif;
  //                 font-size: 14px;
  //                 text-align: center;
  //                 color: #000000;
  //               "
  //             >
  //               PO Box 350, Mount Pleasant, SC 29464
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 font-family: 'Switzer', sans-serif;
  //                 font-size: 14px;
  //                 text-align: center;
  //                 color: #000000;
  //               "
  //             >
  //               📧 info@busybeancoffee.com | 📞 833-843-2326
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 5px;
  //                 font-family: 'Switzer', sans-serif;
  //                 font-size: 13px;
  //                 text-align: center;
  //                 color: #000000;
  //               "
  //             >
  //               Copyright © 2025 BusyBeans
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-left: 37px;
  //                 padding-right: 37px;
  //                 padding-top: 5px;
  //                 font-family: 'Switzer', sans-serif;
  //                 font-size: 13px;
  //                 text-align: center;
  //                 color: #000000;
  //               "
  //             >
  //               <a href="#" style="text-decoration: underline">Unsubscribe</a>
  //             </td>
  //           </tr>
  //           <tr>
  //             <td
  //               style="
  //                 padding-top: 40px;
  //                 font-family: 'Work_Sans', sans-serif;
  //                 font-size: 14px;
  //                 text-align: center;
  //                 color: rgba(0, 0, 0, 0.6);
  //               "
  //             >
  //               Powered by
  //             </td>
  //           </tr>
  //           <tr>
  //             <td align="center">
  //               <img
  //                 src="./images/logo.png"
  //                 alt="Powered by"
  //                 width="118"
  //                 height="55"
  //                 style="border-radius: 16px"
  //               />
  //             </td>
  //           </tr>
  //         </table>
  //       </body>
  //     </html>
      
  //      ${footer}
  //     `,
  //   },
  //   function (error, info) {
  //     if (error) {
  //       console.log(error)
  //     } else {
  //       console.log(info)
  //     }
  //   },
  // )
}
