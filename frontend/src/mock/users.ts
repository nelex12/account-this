import { 
  type UserRole,
  type UserStatus,
  type UserRow,
  type RoleFilter,
} from '../entities/usersModel.ts'

/** Default mock data — used when the caller doesn't provide `rows`. */
export const defaultUserRows: UserRow[] = [
  { id: '1',  applicant: 'Иванов И. И.',    phone: '+7 900 123-45-67', role: 'сотрудник',  status: 'ожидает',   requestedAt: '01.10.2026' },
  { id: '2',  applicant: 'Петров П. П.',    phone: '+7 900 234-56-78', role: 'заведующий', status: 'одобрена',  requestedAt: '02.10.2026' },
  { id: '3',  applicant: 'Сидоров С. С.',   phone: '+7 900 345-67-89', role: 'владелец',   status: 'отклонена', requestedAt: '02.10.2026' },
  { id: '4',  applicant: 'Кузнецова А. А.', phone: '+7 900 456-78-90', role: 'сотрудник',  status: 'ожидает',   requestedAt: '03.10.2026' },
  { id: '5',  applicant: 'Смирнова Е. В.',  phone: '+7 900 567-89-01', role: 'сотрудник',  status: 'одобрена',  requestedAt: '03.10.2026' },
  { id: '6',  applicant: 'Кузнецов Д. А.',  phone: '+7 900 678-90-12', role: 'заведующий', status: 'отклонена', requestedAt: '04.10.2026' },
  { id: '7',  applicant: 'Орлов М. К.',     phone: '+7 900 789-01-23', role: 'сотрудник',  status: 'ожидает',   requestedAt: '05.10.2026' },
  { id: '8',  applicant: 'Васильев П. Н.',  phone: '+7 900 890-12-34', role: 'владелец',   status: 'одобрена',  requestedAt: '06.10.2026' },
  { id: '9',  applicant: 'Новиков С. Р.',   phone: '+7 900 901-23-45', role: 'сотрудник',  status: 'отклонена', requestedAt: '06.10.2026' },
  { id: '10', applicant: 'Козлов Т. Е.',    phone: '+7 900 012-34-56', role: 'заведующий', status: 'ожидает',   requestedAt: '07.10.2026' },
];