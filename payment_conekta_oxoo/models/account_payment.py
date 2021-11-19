# coding: utf-8
import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)

try:
    import conekta
except ImportError as err:
    _logger.debug(err)

CONEKTA_API_VERSION = "0.3.0"

ambiente = 'conekta'

class AccountPaymentConekta(models.Model):

    _inherit = 'account.payment'

    acquirer = fields.Many2one(comodel_name='payment.acquirer', string='Aquirer')
    #cards_conekta = fields.Many2one(comodel_name='conekta.credit.card', domain= lambda self:self._get_domain(),string="Conekta Credit Card")
    hide = fields.Boolean(compute='_hide_cards')
    error = fields.Text(store = False )
    

    def _set_conketa_key(self):
        enviroment = self.acquirer.environment
        if enviroment == 'prod':
            CONEKTA_KEY = self.acquirer.conekta_secret_key
            CONEKTA_PUBLIC_KEY = self.acquirer.conekta_publishable_key
        else:
            CONEKTA_KEY = self.acquirer.conekta_secret_key_test
            CONEKTA_PUBLIC_KEY = self.acquirer.conekta_publishable_key_test

        conekta.api_key = CONEKTA_KEY
        # conekta.api_version = CONEKTA_API_VERSION

        return CONEKTA_KEY

    @api.depends('acquirer')
    def _hide_cards(self):
        if self.acquirer.name == 'Conekta':
            self.hide = True

