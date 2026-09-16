using System.IO;
using System.Text;
using Talisma.Crypto;
using Talisma.DependencyInjection;
using System.Runtime.InteropServices;

namespace api.Utils
{
    public class ConnectionUtils
    {
        IEncryptDecrypt _encryptDecrypt = null;

        public ConnectionUtils()
        {
            _encryptDecrypt = ServiceLocator.Default.GetInstance(typeof(IEncryptDecrypt)) as IEncryptDecrypt;
        }

        private string getEncryptedValue(string decryptedStr)
        {
            string encryptedStr = "";
            encryptedStr = _encryptDecrypt.Encrypt(decryptedStr, new byte[] { 0, 44, 32, 43, 40, 50, 51 });
            return encryptedStr;
        }

        public string getDecryptedValue(string encryptedStr)
        {
            string decryptedStr = "";
            byte[] bytes = { 0, 44, 32, 43, 40, 50, 51 };
            string str = Encoding.UTF8.GetString(bytes);
            decryptedStr = _encryptDecrypt.Decrypt(encryptedStr, new byte[] { 0, 44, 32, 43, 40, 50, 51 });
            return decryptedStr;
        }

        public string getEncryptesLicense(string encryptedStr)
        {
            try
            {
                string decryptedStr = "";
                //try
                //{
                //    int pnActualSize = encryptedStr.Length;
                //    string text = "";
                //    long memAddr = 0L;
                //    byte* ptr = stackalloc byte[501];
                //    IntPtr intPtr = (IntPtr)ptr;
                //    bool flag = DecryptWCHAR2(encryptedStr, intPtr, ref pnActualSize, pnActualSize, strSalt, bCRC: true, bASCII: true, bMacKeySet: true, out memAddr);
                //    text = Marshal.PtrToStringAuto(intPtr);
                //    if (flag)
                //    {
                      
                //            outPassword = text.ToString().ToLower();

                //        return 0;
                //    }
                //}
                //catch (Exception ex)
                //{
                //    decryptedStr = ex.Message;
                //}
                return decryptedStr;
            }
            catch (Exception ex)
            { 
               return ex.Message;
            }
        }

        public string GetConnectionString(string connectionstring)
        {
            var pwd = "";
            try
            {
                var connArr = connectionstring.Split("PWD=");
                if (connArr.Count() == 2)
                {
                    pwd = connArr[1].Split(";")[0];
                    connArr[1] = connArr[1].Replace(pwd, "");
                    pwd = getDecryptedValue(pwd);
                    connectionstring = connArr[0] + "PWD=" + pwd + connArr[1];
                }
                return connectionstring;
            }
            catch (Exception ex)
            {
                return connectionstring;
            }
        }
    }
}
