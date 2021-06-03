# -*- coding: utf-8 -*-

from odoo import models, api, fields
import time
import logging
_logger = logging.getLogger(__name__)

class ReportGeneralLedger(models.AbstractModel):
    _name = 'report.nomina_cfdi_extras_ee.report_calculo_isr_anual'
    _description = 'ReportGeneralLedger'

    @api.model
    def _get_report_values(self, docids, data=None):
        return {
            'doc_ids': docids,
            'doc_model': 'calculo.isr.anual',
            'data': data,
            'docs': self.env['calculo.isr.anual'].browse(docids),
            'time': time,
        }

class CalculoISRAnual(models.TransientModel):
    _name = 'calculo.isr.anual'
    _description = 'CalculoISRAnual'

    ano = fields.Selection([('2019','2019'),('2020','2020'),('2021', '2021')],"Año")
    employee_id =fields.Many2one('hr.employee','Empleado')
    department_id = fields.Many2one('hr.department', 'Departamento')
    
   
    def print_calculo_isr_anual_report(self):
        date_from = self.ano+"-01-01"
        date_to = self.ano+"-12-31"
        domain = [('date_from','>=',date_from), ('date_to', '<=', date_to)]
        domain.append(('state','=', 'done'))
        if self.employee_id:
            domain.append(('employee_id','=',self.employee_id.id))
        elif self.department_id:
            domain.append(('employee_id.department_id','=',self.department_id.id))
        payslips = self.env['hr.payslip'].search(domain)
        all_col_list_seq = []
        all_col_list_seq2 = ['Ingreso gravable', 'ISR retenido', 'SUBEM aplicado', 'SUBEM entregado']
        search_code = ['TPERG', 'ISR2', 'SUB','ISR', 'O007', 'D061','D062', 'D060', 'PQ039', 'PS039']
        result = {}
        result2 = {}
        total_by_code = {}
        emp_by_ids = {}
        emp_ids = []
        for line in payslips.mapped('line_ids'):
            if line.code in search_code: #all_col_list_seq:
                if line.code not in all_col_list_seq:
                    all_col_list_seq.append(line.code)
                    total_by_code[line.code] = 0
                total = line.total
                total_by_code[line.code] += total

                employee = line.slip_id.employee_id
                emp_id = employee.id
                if emp_id not in result:
                    result[emp_id] = {}
                    emp_by_ids[emp_id] = employee.name
                    emp_ids.append(emp_id)
                if line.code not in result[emp_id]:
                    result[emp_id][line.code] = total
                else:
                    result[emp_id][line.code] = result[emp_id][line.code] + total

        for i, val in enumerate(emp_ids):
            TPERG = 0
            subsidio_x_aplicar = 0
            if 'SUB' in result[val]:
               acum_subsidio_aplicado_anual = result[val]['SUB']
            else:
               acum_subsidio_aplicado_anual = 0
            if 'ISR' in result[val]:
               acum_isr_antes_subem_anual = result[val]['ISR']
            else:
               acum_isr_antes_subem_anual = 0
            if 'TPERG' in result[val]:
               acum_per_grav_anual = result[val]['TPERG']
            else:
               acum_per_grav_anual = 0
            if 'ISR2' in result[val]:
               acum_isr_anual = result[val]['ISR2']
            else:
               acum_isr_anual = 0
            if 'O007' in result[val]:
               acum_dev_isr = result[val]['O007']
            else:
               acum_dev_isr = 0
            if 'D061' in result[val]:
               acum_dev_subem = result[val]['D061']
            else:
               acum_dev_subem = 0
            if 'D062' in result[val]:
               acum_dev_subem_entregado = result[val]['D062']
            else:
               acum_dev_subem_entregado = 0
            if 'D060' in result[val]:
               acum_isr_ajuste = result[val]['D060']
            else:
               acum_isr_ajuste = 0
            if 'PQ039' in result[val]:
               acum_subem_entregado = result[val]['PQ039']
            else:
               acum_subem_entregado = 0
            if 'PS039' in result[val]:
               acum_subem_entregado += result[val]['PS039']

            result2[val] = {}
            result2[val]['Ingreso gravable'] = acum_per_grav_anual
            result2[val]['ISR retenido'] = acum_isr_anual + acum_isr_ajuste - acum_dev_isr
            result2[val]['SUBEM aplicado'] = acum_subsidio_aplicado_anual - acum_dev_subem
            result2[val]['SUBEM entregado'] = acum_subem_entregado - acum_dev_subem_entregado

        company = self.env.user.company_id
        data = {'emp_by_ids' : emp_by_ids,'result':result2,'all_col_list_seq' :all_col_list_seq2, 'company_name' : company.name, 'company_rfc' : company.rfc or '', 'total_by_code':total_by_code}
        return self.sudo().env.ref('nomina_cfdi_extras_ee.action_report_calculo_isr_anual').report_action(self, data=data)
