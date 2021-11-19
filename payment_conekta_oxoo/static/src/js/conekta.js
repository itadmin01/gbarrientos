odoo.define('payment_conekta_oxoo.conekta', function(require) {
    "use strict";
   
    var PaymentForm = require('payment.payment_form');
    var ajax = require('web.ajax');
    var core = require('web.core');
    var _t = core._t;

    PaymentForm.include({
    	payEvent: function (ev) {
            ev.preventDefault();
            var form = this.el;
            var checked_radio = this.$('input[type="radio"]:checked');
            var self = this;
            var button = ev.target;

            // first we check that the user has selected a payment method
            if (checked_radio.length === 1) {
                checked_radio = checked_radio[0];

                // we retrieve all the input inside the acquirer form and 'serialize' them to an indexed array
                var acquirer_id = this.getAcquirerIdFromRadio(checked_radio);
                var acquirer_form = false;
                if (this.isNewPaymentRadio(checked_radio)) {
                    acquirer_form = this.$('#o_payment_add_token_acq_' + acquirer_id);
                } else {
                    acquirer_form = this.$('#o_payment_form_acq_' + acquirer_id);
                }
                var inputs_form = $('input', acquirer_form);
                var ds = $('input[name="data_set"]', acquirer_form)[0];

                // if the user is adding a new payment
                if (this.isNewPaymentRadio(checked_radio)) {
                    if (this.options.partnerId === undefined) {
                        console.warn('payment_form: unset partner_id when adding new token; things could go wrong');
                    }
                    var form_data = this.getFormData(inputs_form);
                    var wrong_input = false;

                    inputs_form.toArray().forEach(function (element) {
                        //skip the check of non visible inputs
                        if ($(element).attr('type') == 'hidden') {
                            return true;
                        }
                        $(element).closest('div.form-group').removeClass('o_has_error').find('.form-control, .custom-select').removeClass('is-invalid');
                        $(element).siblings( ".o_invalid_field" ).remove();
                        //force check of forms validity (useful for Firefox that refill forms automatically on f5)
                        $(element).trigger("focusout");
                        if (element.dataset.isRequired && element.value.length === 0) {
                                $(element).closest('div.form-group').addClass('o_has_error').find('.form-control, .custom-select').addClass('is-invalid');
                                $(element).closest('div.form-group').append('<div style="color: red" class="o_invalid_field" aria-invalid="true">' + _.str.escapeHTML("The value is invalid.") + '</div>');
                                wrong_input = true;
                        }
                        else if ($(element).closest('div.form-group').hasClass('o_has_error')) {
                            wrong_input = true;
                            $(element).closest('div.form-group').append('<div style="color: red" class="o_invalid_field" aria-invalid="true">' + _.str.escapeHTML("The value is invalid.") + '</div>');
                        }
                    });

                    if (wrong_input) {
                        return;
                    }

                    this.disableButton(button);

                    var verify_validity = this.$el.find('input[name="verify_validity"]');

                    if (verify_validity.length>0) {
                        form_data.verify_validity = verify_validity[0].value === "1";
                    }
                    
                    if ($(checked_radio).data('provider')==='conekta'){
                    	var conektaSuccessResponseHandler = function(token) {
                            var checked_radio = $('input[type="radio"]:checked');
                            if (checked_radio.length>1){
                            	var chk_radio = checked_radio.find('#pm_id');
                            	if (chk_radio.length){
                            		checked_radio = chk_radio;
                            	}
                            	else{
                            		checked_radio = $(checked_radio[1]);
                            	}
                            }
                            	
                            var acquirer_id = checked_radio.data('acquirer-id') 
                            var acquirer_form = $('#o_payment_add_token_acq_' + acquirer_id);
                            var inputs_form = $('input', acquirer_form);
                            var ds = $('input[name="data_set"]', acquirer_form)[0];
                            
                            var unindexed_array = inputs_form.serializeArray();
                            var form_data = {};
                            $.map(unindexed_array, function (n, i) {
                            	form_data[n.name] = n.value;
                            });
                            form_data['conekta_token'] = token.id
                            var form = $('.o_payment_form');
                            var button = "#o_payment_form_pay";
                            // do the call to the route stored in the 'data_set' input of the acquirer form, the data must be called 'create-route'
                            return ajax.jsonRpc(ds.dataset.createRoute, 'call', form_data).then(function (data) {
                                // if the server has returned true
                                if (data.result) {
                                    // and it need a 3DS authentication
                                    form_data['form_action']=form[0].action;
                                    form_data['token_id'] = data.id;
                                	
                                    return ajax.jsonRpc('/payment/conekta/create_charge', 'call', 
                                    form_data
                                    ).always(function(){
                                        if ($.blockUI) {
                                            $.unblockUI();
                                        }
                                    }).done(function(data){
                                        window.location.href = data;
                                    }).fail(function (error, event) {
                                        // if the rpc fails, pretty obvious
                                        self.disableButton(button);
										
                                        var messageResult = '<div class="alert alert-danger mb4" id="payment_error">';
                                        messageResult = messageResult + '<b>' + _.str.escapeHTML('Server Error') + ':</b></br>';
                                        messageResult = messageResult + _.str.escapeHTML('We are not able to add your payment method at the moment.'+error.data.message) + '</div>';
                                        acquirer_form.append(messageResult);
                                        
                                    });
                                }
                                // if the server has returned false, we display an error
                                else {
                                    if (data.error) {
                                    	$('#payment_error').remove();
                                        var messageResult = '<div class="alert alert-danger mb4" id="payment_error">';
                                        messageResult = messageResult + _.str.escapeHTML(data.error) + '</div>';
                                        acquirer_form.append(messageResult);
                                    } else { // if the server doesn't provide an error message
                                    	$('#payment_error').remove();
                                        var messageResult = '<div class="alert alert-danger mb4" id="payment_error">';
                                        messageResult = messageResult + '<b>' + _.str.escapeHTML('Server Error') + ':</b></br>';
                                        messageResult = messageResult + _.str.escapeHTML('e.g. Your credit card details are wrong. Please verify.') + '</div>';
                                        acquirer_form.append(messageResult);
                                        
                                    }
                                }
                                // here we remove the 'processing' icon from the 'add a new payment' button
                                self.disableButton(button);
                            }).fail(function (error, event) {
                                // if the rpc fails, pretty obvious
                            	var error_message = error.data.message;
                                if (!acquirer_form[0].innerText.includes(error_message.substring(0, error_message.length - 1))){
                                	self.disableButton(button);
                                    var messageResult = '<div class="alert alert-danger mb4" id="payment_error">';
                                    messageResult = messageResult + '<b>' + _.str.escapeHTML('Server Error') + ':</b></br>';
                                    messageResult = messageResult + _.str.escapeHTML('We are not able to add your payment method at the moment.'+error_message) + '</div>';
                                    acquirer_form.append(messageResult);
                                }
                            });
                            
							var $form = $("#card-form");
							$form.append($("<input type='hidden' name='token_id'>").val(token.id));
							ajax.jsonRpc('/payment/conekta/charge', 'call', {'token': token.id}).then(function(response) {
							    if (response === true) {
							        $form.get(0).submit();
							    } else {
							        $form.find(".card-errors").text(response).addClass("alert alert-danger");
							        $form.find("button").prop("disabled", false).button('reset');
							    }
							});
                        };
                        var conektaErrorResponseHandler = function(response) {
                        	
                        	self.displayError('',response.message);
							
                        	/*var $form = $("#card-form");
                            $form.find(".card-errors").text(response.message);
                            $form.find("button").prop("disabled", false);*/
                        };
                    	
                    	var month_year = form_data.cc_expiry.split(" / ")
                    	var exp_year = new Date().getFullYear().toString().substr(0,2) + month_year[1]
                    	var tokenParams = {
                    			  "card": {
                    			    "number": form_data.cc_number,
                    			    "name": form_data.cc_holder_name,
                    			    "exp_year": exp_year,
                    			    "exp_month": month_year[0],
                    			    "cvc": form_data.cvc,
                    			  }
                    			};
                    	Conekta.setPublicKey(form_data.conekta_public_key);
                    	Conekta.Token.create(tokenParams, conektaSuccessResponseHandler, conektaErrorResponseHandler);
                    	return false;
                    }
                    else{
                    	
                    	// do the call to the route stored in the 'data_set' input of the acquirer form, the data must be called 'create-route'
                        return ajax.jsonRpc(ds.dataset.createRoute, 'call', form_data).then(function (data) {
                            // if the server has returned true
                            if (data.result) {
                                // and it need a 3DS authentication
                                if (data['3d_secure'] !== false) {
                                    // then we display the 3DS page to the user
                                    $("body").html(data['3d_secure']);
                                }
                                else {
                                    checked_radio.value = data.id; // set the radio value to the new card id
                                    form.submit();
                                    return $.Deferred();
                                }
                            }
                            // if the server has returned false, we display an error
                            else {
                                if (data.error) {
                                    self.displayError(
                                        '',
                                        data.error);
                                } else { // if the server doesn't provide an error message
                                    self.displayError(
                                        _t('Server Error'),
                                        _t('e.g. Your credit card details are wrong. Please verify.'));
                                }
                            }
                            // here we remove the 'processing' icon from the 'add a new payment' button
                            self.enableButton(button);

                        }).fail(function (error, event) {
                            // if the rpc fails, pretty obvious
                            self.enableButton(button);

                            self.displayError(
                                _t('Server Error'),
                                _t("We are not able to add your payment method at the moment.") +
                                   error.data.message
                            );
                        });
                    }
                }
                // if the user is going to pay with a form payment, then
                else if (this.isFormPaymentRadio(checked_radio)) {
                    this.disableButton(button);
					var $tx_url = this.$el.find('input[name="prepare_tx_url"]');
                    // if there's a prepare tx url set
                    
                    if ($tx_url.length === 1) {
                        // if the user wants to save his credit card info
                        var form_save_token = acquirer_form.find('input[name="o_payment_form_save_token"]').prop('checked');
                        // then we call the route to prepare the transaction
                        return ajax.jsonRpc($tx_url[0].value, 'call', {
                            'acquirer_id': parseInt(acquirer_id),
                            'save_token': form_save_token,
                            'access_token': self.options.accessToken,
                            'success_url': self.options.successUrl,
                            'error_url': self.options.errorUrl,
                            'callback_method': self.options.callbackMethod,
                            'order_id': self.options.orderId,
                        }).then(function (result) {
                            if (result) {
                                // if the server sent us the html form, we create a form element
                                var newForm = document.createElement('form');
                                newForm.setAttribute("method", "post"); // set it to post
                                newForm.setAttribute("provider", checked_radio.dataset.provider);
                                newForm.hidden = true; // hide it
                                newForm.innerHTML = result; // put the html sent by the server inside the form
								var phone = $(newForm).find('input[name="phone"]')
								if ($(checked_radio).data('provider')==='conekta_oxxo' && phone.length > 0  && phone.val().length < 10){
									self.displayError(
			                            _t('Server Error'),
			                            _t("Please enter valid phone number. Length of phone number must be 10 digits. ")
			                        );
									self.enableButton(button);
								}
								else{
									var action_url = $(newForm).find('input[name="data_set"]').data('actionUrl');
		                            newForm.setAttribute("action", action_url); // set the action url
		                            $(document.getElementsByTagName('body')[0]).append(newForm); // append the form to the body
		                            $(newForm).find('input[data-remove-me]').remove(); // remove all the input that should be removed
		                            if(action_url) {
		                                newForm.submit(); // and finally submit the form
		                            }	
								}
                            }
                            else {
                                self.displayError(
                                    _t('Server Error'),
                                    _t("We are not able to redirect you to the payment form.")
                                );
								self.enableButton(button);
                            }
                        }).fail(function (error, event) {
                            self.displayError(
                                _t('Server Error'),
                                _t("We are not able to redirect you to the payment form. ") +
                                   error.data.message
                            );
							self.enableButton(button);
                        });
                    }
                    else {
                        // we append the form to the body and send it.
                        this.displayError(
                            _t("Cannot set-up the payment"),
                            _t("We're unable to process your payment.")
                        );
                    }
                }
                else {  // if the user is using an old payment then we just submit the form
                    this.disableButton(button);
					form.submit();
                    return $.Deferred();
                }
            }
            else {
				this.displayError(
                    _t('No payment method selected'),
                    _t('Please select a payment method.')
                );
				this.enableButton(button);
            }
        },
    });
});
