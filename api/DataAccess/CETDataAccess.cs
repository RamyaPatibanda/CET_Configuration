using System.Data;
using System.Data.SqlClient;
using Talisma.Configuration;
using Talisma.DependencyInjection;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.VisualBasic;
using Serilog;
using api.Utils;

namespace api.DataAccess
{
    public class CETDataAccess
    {
        public readonly string DBConnectionStr = null;

        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;


        public CETDataAccess(IConfiguration configuration, IMemoryCache cache)
        {
            _configuration = configuration;
            _cache = cache;
            DBConnectionStr = new ConnectionUtils().GetConnectionString(_configuration["ConnectionStrings:CrmDbConnection"]);
        }


    }
}
