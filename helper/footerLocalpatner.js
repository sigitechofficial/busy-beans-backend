function generateFooterHtml({
  origin = '',
  address,
  copyRight = 'Copyright � 2025 Busy Bean Coffee Inc.',
  supportEmail = '',
  supportNumber = '',
}) {
  console.log('🚀 ~ generateFooterHtml ~ address:', address);
  console.log('🚀 ~ generateFooterHtml ~ supportNumber:', supportNumber);
  console.log('🚀 ~ generateFooterHtml ~ supportEmail:', supportEmail);
  return ` <tr>
        <td
          style="
            padding-top: 40px;
            font-family: 'Switzer', sans-serif;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
          "
        >
          Follow Us
        </td>
      </tr>
      <tr>
  <td style="padding-top: 10px; text-align: center">
    <a href="https://www.facebook.com/busybeancoffeeinc/"
      style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #8F5D46; margin-right: 10px; text-align: center; line-height: 44px;">
      <img src="cid:facebook" alt="Facebook" style="width: 24px; height: 24px; vertical-align: middle;" />
    </a>

    <a href="https://x.com/busybean_coffee"
      style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #8F5D46; margin-right: 10px; text-align: center; line-height: 44px;">
      <img src="cid:twitter" alt="Twitter" style="width: 24px; height: 24px; vertical-align: middle;" />
    </a>

    <a href="https://www.instagram.com/busybean_coffee/"
      style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #8F5D46; margin-right: 10px; text-align: center; line-height: 44px;">
      <img src="cid:instagram" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle;" />
    </a>

    <a href="https://www.linkedin.com/in/thecoffeeman/"
      style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #8F5D46; margin-right: 10px; text-align: center; line-height: 44px;">
      <img src="cid:linkedin" alt="LinkedIn" style="width: 24px; height: 24px; vertical-align: middle;" />
    </a>

    <a href="https://www.youtube.com/channel/UC4b4PYax5H3jRSyw4r0MCjQ/featured"
      style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background-color: #8F5D46; text-align: center; line-height: 44px;">
      <img src="cid:youtube" alt="YouTube" style="width: 26px; height: 24px; vertical-align: middle;" />
    </a>
  </td>
</tr>

      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            font-family: 'Switzer', sans-serif;
            font-size: 13px;
            text-align: center;
            color: #000000;
          "
        >
          ${address}
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 10px;
            font-family: 'Switzer', sans-serif;
            font-size: 13px;
            text-align: center;
            color: #000000;
          "
        >
          ${supportEmail} ${supportNumber}
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 10px;
            font-family: 'Switzer', sans-serif;
            font-size: 13px;
            text-align: center;
            color: #000000;
          "
        >
          Copyright © 2025 Busy Bean Coffee, Inc.
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 10px;
            font-family: 'Switzer', sans-serif;
            font-size: 13px;
            text-align: center;
            color: #000000;
          "
        >
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-top: 40px;
            font-family: 'Work_Sans', sans-serif;
            font-size: 14px;
            text-align: center;
            color: rgba(0, 0, 0, 0.6);
          "
        >
          Powered by
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 20px">
          <a href="https://busybeancoffee.com" target="_blank" rel="noopener noreferrer">
          <img
            src="https://backendbb.trimworldwide.com/helper/images/logo.png"
            alt="Powered by"
            width="150"
            style="border-radius: 16px; object"
          />
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = generateFooterHtml;
