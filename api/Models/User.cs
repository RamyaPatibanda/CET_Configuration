namespace api.Models
{
    public class User
    {
        public int aUserId { get; set; }

        public string tUsername { get; set; } = string.Empty;

        public string tPasswordHash { get; set; } = string.Empty;

        public bool bIsAdmin { get; set; }

        public bool bIsActive { get; set; }

        public DateTime dtCreatedDate { get; set; }
    }
}
