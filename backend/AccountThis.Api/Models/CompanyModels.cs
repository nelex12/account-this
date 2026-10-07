namespace AccountThis.Api.Models;

// components.schemas.Company
// У компании только название. Id неугадываемый: Owner сообщает его сотрудникам и завхозам (GET /api/companies/my),
// и они указывают его при регистрации. Списка компаний нет.
public class Company
{
    public Guid Id { get; set; }

    // Не длиннее 100 символов, не уникально
    public string Name { get; set; } = string.Empty;
}
