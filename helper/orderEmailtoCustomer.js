const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })

const { attachments } = require('./attactments')
const attachment = attachments()
const { transporter } = require('./transpoter')
const { footer } = require('./footer')
const { emailDateFormate } = require('../utils/emailDateFormate')

module.exports = function ({ email,data, satge = 'Confirmed',invoice}) {
 
 let orderNote = `Your order has been confirmed and will be prepared according to the
                instructions.`
  let hiCustomer = `Hi ${data?.customerName}!`
   let items = [] 
   console.log("data?.itemsdata?.itemsdata?.itemsdata?.items",data?.items)
  data?.items.forEach((ele) => {
    let temp = `<tr>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                      "
                    >
                      ${ele.qty}x ${ele.product}
                    </td>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                        text-align: right;
                      "
                    >
                      $${ele.price}
                    </td>
            </tr>`
    temp = items.push(temp);
    return temp;
  });

  items = items.join('');  

  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: email, //`${email}` list of receivers
      subject: `Order Confirmed ${data.id}`, // Subject line
      attachments: attachment.footer,
      html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link
            href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&display=swap"
            rel="stylesheet"
          />
          <title>Welcome to Busy Bean</title>
        </head>
        <body
          style="
            margin: 0;
            padding: 10px 0px;
            font-family: Arial, sans-serif;
            background-color: #f8f8f8;
          "
        >
          <table
            align="center"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="100%"
            style="border-collapse: collapse; max-width: 600px"
          >
            <tr>
              <td align="center" style="padding: 20px 0">
                <img
                  src="cid:logo"
                  alt="Image"
                  width="316"
                  height="147"
                  style="border-radius: 16px"
                />
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  font-family: 'Chivo', sans-serif;
                  color: #000000;
                  font-size: 24px;
                  font-weight: bold;
                  line-height: 1.5;
                "
              >
                ${hiCustomer}
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                Thank you for your order!
              </td>
            </tr>
                 <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
         You have placed an order on Busy Bean. Please review the details below and click the button to pay your invoice.
        </td>
      </tr>
       <tr align="center">
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          "
        >
          <a
            href="${invoice?.hostedInvoiceUrl}"
            style="
              padding: 10px 20px;
              background-color: #86644c;
              color: #ffffff;
              text-decoration: none;
              border-radius: 5px;
              font-family: 'Chivo', sans-serif;
              font-size: 16px;
            "
          >
            Pay Invoice
          </a>
          
        </td>
      </tr>
            <tr align="center">
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 20px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                <span style="font-weight: 600; font-size: larger"
                  >Order Status:
                </span>
                <span
                  style="
                    font-weight: bold;
                    color: #322a23;
                    background-color: #86644c;
                    padding: 10px 10px;
                    border-radius: 60px;
                  "
                  >${satge}</span
                >
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 20px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                <span style="font-weight: 600; font-size: large">Order Note:</span>
                <br />
                ${orderNote}
              </td>
            </tr>
            <tr>
              <td
                align="center"
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 10px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                <span style="font-weight: bold">Order No:</span>
                <span style="font-weight: bold; color: #86644c">${data.id}</span><br />
                <span style="font-weight: bold">Payment method: </span>${data.paymentMethod}<br />
                Order Date: ${data.on}
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 20px;
                  font-family: 'Chivo', sans-serif;
                  font-weight: bold;
                  font-size: 18px;
                  color: #000000;
                "
              >
                Order Details
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 10px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                <table
                  width="100%"
                  cellspacing="0"
                  cellpadding="5"
                  style="border: 1px solid #d9d9d9; margin-top: 10px"
                >
                 ${items}
                  <tr>
                    <td
                      align="end"
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                        font-weight: bold;
                      "
                    >
                      Sub Total:
                    </td>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                        text-align: right;
                      "
                    >
                      $${data?.subTotal}
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="end"
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                      "
                    >
                      Discount:
                    </td>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                        text-align: right;
                      "
                    >
                      ${data.discountPrice}
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="end"
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                      "
                    >
                      Shipping Charges:
                    </td>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        color: rgba(0, 0, 0, 0.8);
                        text-align: right;
                      "
                    >
                      $${data?.shippingCharges || 0.00}
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="end"
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        font-weight: bold;
                        color: rgba(0, 0, 0, 0.8);
                      "
                    >
                      Total:
                    </td>
                    <td
                      style="
                        font-family: 'Chivo', sans-serif;
                        font-size: 16px;
                        font-weight: bold;
                        color: rgba(0, 0, 0, 0.8);
                        text-align: right;
                      "
                    >
                      $${data?.totalBill}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td
                style="
                  padding-left: 37px;
                  padding-right: 37px;
                  padding-top: 20px;
                  font-family: 'Chivo', sans-serif;
                  color: rgba(0, 0, 0, 0.8);
                  font-size: 16px;
                  line-height: 1.5;
                "
              >
                If you have any questions, feel free to reach out to our support team.
              </td>
            </tr>
       ${footer}
      `,
    },
    function (error, info) {
      if (error) {
        console.log(error)
      } else {
        console.log(info)
      }
    },
  )
}
